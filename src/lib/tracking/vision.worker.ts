/// <reference lib="webworker" />

import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  FaceTracking,
  HandSample,
  HandTracking,
  TrackerMode,
  TrackingFrame,
  VisionWorkerInMessage,
  VisionWorkerOutMessage,
} from "../../types";
import {
  airTapSignal,
  distance,
  mirrorPoint,
  nextPinchState,
  smoothPoint,
} from "./math";
import { estimateFaceAim, smoothFaceAim } from "./faceAim";

const worker = self as DedicatedWorkerGlobalScope;
let baseUrl = "";
let mode: TrackerMode = "off";
let recognizer: GestureRecognizer | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let handInitialization: Promise<void> | null = null;
let faceInitialization: Promise<void> | null = null;
let handFailure: Error | null = null;
let faceFailure: Error | null = null;
let baseFileset: Awaited<
  ReturnType<typeof FilesetResolver.forVisionTasks>
> | null = null;
let wasmInstance = 0;
let smoothedFaceAim: { x: number; y: number } | null = null;
let lightSample = 0;
let poorLight = false;
const lightCanvas =
  typeof OffscreenCanvas === "undefined" ? null : new OffscreenCanvas(32, 18);
const lightContext =
  lightCanvas?.getContext("2d", { willReadFrequently: true }) ?? null;

function post(message: VisionWorkerOutMessage): void {
  worker.postMessage(message);
}

async function freshFileset(): Promise<
  Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
> {
  baseFileset ??= await FilesetResolver.forVisionTasks(
    `${baseUrl}/mediapipe/wasm`,
    true,
  );
  wasmInstance += 1;
  const separator = baseFileset.wasmLoaderPath.includes("?") ? "&" : "?";
  return {
    ...baseFileset,
    wasmLoaderPath: `${baseFileset.wasmLoaderPath}${separator}instance=${wasmInstance}`,
  };
}

async function createWithDelegate<T>(
  factory: (
    delegate: "GPU" | "CPU",
    fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  ) => Promise<T>,
): Promise<T> {
  try {
    return await factory("GPU", await freshFileset());
  } catch {
    return factory("CPU", await freshFileset());
  }
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

async function initializeHand(): Promise<void> {
  recognizer = await createWithDelegate((delegate, fileset) =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${baseUrl}/models/gesture_recognizer.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      cannedGesturesClassifierOptions: { scoreThreshold: 0.55 },
    }),
  );
}

async function ensureHand(forceRetry = false): Promise<void> {
  if (recognizer) return;
  if (handInitialization) return handInitialization;
  if (handFailure && !forceRetry) throw handFailure;
  if (forceRetry) handFailure = null;

  handInitialization = initializeHand()
    .catch((error: unknown) => {
      handFailure = normalizeError(error, "Could not load hand tracking.");
      throw handFailure;
    })
    .finally(() => {
      handInitialization = null;
    });
  return handInitialization;
}

async function initializeFace(): Promise<void> {
  faceLandmarker = await createWithDelegate((delegate, fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${baseUrl}/models/face_landmarker.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
      outputFaceBlendshapes: true,
    }),
  );
}

async function ensureFace(forceRetry = false): Promise<void> {
  if (faceLandmarker) return;
  if (faceInitialization) return faceInitialization;
  if (faceFailure && !forceRetry) throw faceFailure;
  if (forceRetry) faceFailure = null;

  faceInitialization = initializeFace()
    .catch((error: unknown) => {
      faceFailure = normalizeError(error, "Could not load face tracking.");
      throw faceFailure;
    })
    .finally(() => {
      faceInitialization = null;
    });
  return faceInitialization;
}

function toPoint(landmark: NormalizedLandmark): { x: number; y: number } {
  return { x: landmark.x, y: landmark.y };
}

interface TrackedHandState {
  smoothedPointer: { x: number; y: number } | null;
  smoothedThumb: { x: number; y: number } | null;
  smoothedMiddle: { x: number; y: number } | null;
  pinching: boolean;
  previousPokeDepth: number | null;
  previousPokeTimestamp: number;
  previousPalmWidth: number | null;
  lastTapTimestamp: number;
}

interface HandReadResult {
  hand: HandTracking | null;
  hands: HandSample[];
}

const handStates = new Map<string, TrackedHandState>();

function createHandState(): TrackedHandState {
  return {
    smoothedPointer: null,
    smoothedThumb: null,
    smoothedMiddle: null,
    pinching: false,
    previousPokeDepth: null,
    previousPokeTimestamp: 0,
    previousPalmWidth: null,
    lastTapTimestamp: -Infinity,
  };
}

function resetHandTracking(): void {
  handStates.clear();
}

function readTrackedHand(
  landmarks: NormalizedLandmark[],
  worldLandmarks: NormalizedLandmark[] | undefined,
  handedness: string | null,
  gesture: { categoryName?: string; score?: number } | undefined,
  index: number,
  timestamp: number,
): { key: string; hand: HandTracking; sample: HandSample } {
  const key = handedness ?? `hand-${index}`;
  let state = handStates.get(key);
  if (!state) {
    state = createHandState();
    handStates.set(key, state);
  }

  const palm = mirrorPoint(toPoint(landmarks[9]));
  const wrist = mirrorPoint(toPoint(landmarks[0]));
  const pointer = mirrorPoint(toPoint(landmarks[8]));
  const thumb = mirrorPoint(toPoint(landmarks[4]));
  const middle = mirrorPoint(toPoint(landmarks[12]));
  state.smoothedPointer = smoothPoint(state.smoothedPointer, pointer);
  state.smoothedThumb = smoothPoint(state.smoothedThumb, thumb, 0.45);
  state.smoothedMiddle = smoothPoint(state.smoothedMiddle, middle, 0.5);
  const palmWidth = Math.max(
    distance(toPoint(landmarks[5]), toPoint(landmarks[17])),
    0.001,
  );
  const pinchRatio =
    distance(toPoint(landmarks[4]), toPoint(landmarks[8])) / palmWidth;
  state.pinching = nextPinchState(state.pinching, pinchRatio);
  const depthPalmWidth = worldLandmarks
    ? Math.max(
        distance(toPoint(worldLandmarks[5]), toPoint(worldLandmarks[17])),
        0.01,
      )
    : palmWidth;
  const wristDepth = worldLandmarks?.[0]?.z ?? landmarks[0].z;
  const indexDepth = worldLandmarks?.[8]?.z ?? landmarks[8].z;
  const pokeDepth = (wristDepth - indexDepth) / depthPalmWidth;
  const deltaSeconds = state.previousPokeTimestamp
    ? Math.max((timestamp - state.previousPokeTimestamp) / 1000, 0.001)
    : 0;
  const pokeVelocity =
    state.previousPokeDepth === null || !deltaSeconds
      ? 0
      : (pokeDepth - state.previousPokeDepth) / deltaSeconds;
  const scaleVelocity =
    state.previousPalmWidth === null || !deltaSeconds
      ? 0
      : (palmWidth - state.previousPalmWidth) / deltaSeconds;
  const tapSignal = airTapSignal(
    pokeVelocity,
    scaleVelocity,
    timestamp - state.lastTapTimestamp,
  );
  if (tapSignal.tap) state.lastTapTimestamp = timestamp;
  state.previousPokeDepth = pokeDepth;
  state.previousPokeTimestamp = timestamp;
  state.previousPalmWidth = palmWidth;

  const cleanGesture =
    gesture?.categoryName && gesture.categoryName !== "None"
      ? gesture.categoryName
      : null;
  const fingerExtended = (tipIndex: number, pipIndex: number) =>
    distance(toPoint(landmarks[0]), toPoint(landmarks[tipIndex])) >
    distance(toPoint(landmarks[0]), toPoint(landmarks[pipIndex])) +
      palmWidth * 0.18;
  const twoFinger =
    cleanGesture === "Victory" ||
    (cleanGesture !== "Open_Palm" &&
      fingerExtended(8, 6) &&
      fingerExtended(12, 10) &&
      !fingerExtended(16, 14) &&
      !fingerExtended(20, 18));
  const hand: HandTracking = {
    pointer: state.smoothedPointer,
    index: state.smoothedPointer,
    middle: state.smoothedMiddle,
    thumb: state.smoothedThumb,
    twoFinger,
    pinch: state.pinching,
    pinchRatio,
    tap: tapSignal.tap,
    tapStrength: tapSignal.strength,
    gesture: cleanGesture,
    gestureScore: gesture?.score ?? 0,
    handedness,
  };

  return {
    key,
    hand,
    sample: {
      point: palm,
      wrist,
      index: state.smoothedPointer,
      tap: tapSignal.tap,
      tapStrength: tapSignal.strength,
      handedness,
    },
  };
}

function readHand(bitmap: ImageBitmap, timestamp: number): HandReadResult {
  if (!recognizer) return { hand: null, hands: [] };
  const result = recognizer.recognizeForVideo(bitmap, timestamp);
  if (!result.landmarks.length) {
    resetHandTracking();
    return { hand: null, hands: [] };
  }

  const seenKeys = new Set<string>();
  const readings = result.landmarks.map((landmarks, index) => {
    const reading = readTrackedHand(
      landmarks,
      result.worldLandmarks[index],
      result.handedness[index]?.[0]?.categoryName ?? null,
      result.gestures[index]?.[0],
      index,
      timestamp,
    );
    seenKeys.add(reading.key);
    return reading;
  });
  for (const key of handStates.keys()) {
    if (!seenKeys.has(key)) handStates.delete(key);
  }

  return {
    hand: readings[0]?.hand ?? null,
    hands: readings.map((reading) => reading.sample),
  };
}

function readFace(bitmap: ImageBitmap, timestamp: number): FaceTracking | null {
  if (!faceLandmarker) return null;
  const result = faceLandmarker.detectForVideo(bitmap, timestamp);
  const categories = result.faceBlendshapes[0]?.categories;
  const landmarks = result.faceLandmarks[0];
  if (!categories?.length && !landmarks?.length) {
    smoothedFaceAim = null;
    return null;
  }
  const values = new Map(
    (categories ?? []).map((category) => [
      category.categoryName,
      category.score,
    ]),
  );
  const aim = landmarks ? estimateFaceAim(landmarks) : null;
  smoothedFaceAim = aim ? smoothFaceAim(smoothedFaceAim, aim) : null;

  return {
    smile:
      ((values.get("mouthSmileLeft") ?? 0) +
        (values.get("mouthSmileRight") ?? 0)) /
      2,
    jawOpen: values.get("jawOpen") ?? 0,
    browRaise: values.get("browInnerUp") ?? 0,
    aim: smoothedFaceAim,
  };
}

function updateLightQuality(bitmap: ImageBitmap): void {
  lightSample += 1;
  if (!lightContext || lightSample % 15 !== 0) return;
  lightContext.drawImage(bitmap, 0, 0, 32, 18);
  const pixels = lightContext.getImageData(0, 0, 32, 18).data;
  let luminance = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    luminance +=
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
  }
  poorLight = luminance / (pixels.length / 16) < 38;
}

async function handleFrame(
  bitmap: ImageBitmap,
  timestamp: number,
): Promise<void> {
  const started = performance.now();
  let hand: HandTracking | null = null;
  let hands: HandSample[] = [];
  let face: FaceTracking | null = null;
  try {
    updateLightQuality(bitmap);
    if (mode === "hand") {
      await ensureHand();
      const read = readHand(bitmap, timestamp);
      hand = read.hand;
      hands = read.hands;
    } else if (mode === "face") {
      await ensureFace();
      face = readFace(bitmap, timestamp);
    }
    const frame: TrackingFrame = {
      timestamp,
      mode,
      hand,
      hands,
      face,
      quality: hand || face ? "good" : poorLight ? "poor-light" : "searching",
      inferenceMs: performance.now() - started,
    };
    post({ type: "result", frame });
  } catch (error) {
    post({
      type: "error",
      message:
        error instanceof Error ? error.message : "Vision processing failed.",
    });
  } finally {
    bitmap.close();
  }
}

worker.addEventListener(
  "message",
  (event: MessageEvent<VisionWorkerInMessage>) => {
    const message = event.data;
    if (message.type === "init") {
      baseUrl = message.baseUrl;
      post({ type: "ready", mode });
      return;
    }
    if (message.type === "warm-face") {
      // Best-effort preload. A genuine failure surfaces (and retries) when face
      // mode is actually activated via set-mode, so we must not block here.
      void ensureFace().catch(() => undefined);
      return;
    }
    if (message.type === "set-mode") {
      mode = message.mode;
      resetHandTracking();
      smoothedFaceAim = null;
      const ensure =
        mode === "face"
          ? ensureFace(true)
          : mode === "hand"
            ? ensureHand(true)
            : Promise.resolve();
      void ensure
        .then(() => post({ type: "ready", mode }))
        .catch((error: unknown) =>
          post({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not change tracker.",
          }),
        );
      return;
    }
    if (message.type === "frame")
      void handleFrame(message.bitmap, message.timestamp);
  },
);

export {};
