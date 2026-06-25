import { useEffect, useRef, useState } from "react";
import type {
  TrackerMode,
  TrackingFrame,
  TrackingQuality,
  VisionWorkerInMessage,
  VisionWorkerOutMessage,
} from "../types";

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;

async function captureVideoFrame(
  video: HTMLVideoElement,
  fallbackCanvasRef: { current: HTMLCanvasElement | null },
): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot capture camera frames for tracking.");
  }

  try {
    return await createImageBitmap(video, {
      resizeWidth: FRAME_WIDTH,
      resizeHeight: FRAME_HEIGHT,
      resizeQuality: "low",
    });
  } catch {
    const canvas =
      fallbackCanvasRef.current ?? document.createElement("canvas");
    fallbackCanvasRef.current = canvas;
    if (canvas.width !== FRAME_WIDTH) canvas.width = FRAME_WIDTH;
    if (canvas.height !== FRAME_HEIGHT) canvas.height = FRAME_HEIGHT;
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      try {
        return await createImageBitmap(canvas);
      } catch {
        // Fall through to a full-size capture for browsers that support video
        // sources but not canvas sources in createImageBitmap.
      }
    }

    return createImageBitmap(video);
  }
}

export function useVisionTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null,
  mode: TrackerMode,
  warmFace: boolean,
) {
  const workerRef = useRef<Worker | null>(null);
  const framePending = useRef(false);
  const latestFrame = useRef<TrackingFrame | null>(null);
  const modeRef = useRef(mode);
  const [quality, setQuality] = useState<TrackingQuality>("loading");
  const qualityRef = useRef<TrackingQuality>("loading");
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState("");
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fpsCounter = useRef({ count: 0, started: performance.now() });

  useEffect(() => {
    const setReadyState = (nextReady: boolean) => {
      readyRef.current = nextReady;
      setReady(nextReady);
    };
    const visionWorker = new Worker(
      new URL("../lib/tracking/vision.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = visionWorker;
    visionWorker.onmessage = (event: MessageEvent<VisionWorkerOutMessage>) => {
      const message = event.data;
      if (message.type === "error") {
        framePending.current = false;
        setError(message.message);
        setReadyState(false);
        qualityRef.current = "error";
        setQuality("error");
        return;
      }
      if (message.type === "ready") {
        setError("");
        if (message.mode === modeRef.current && message.mode !== "off") {
          setReadyState(true);
          if (qualityRef.current === "loading") {
            qualityRef.current = "searching";
            setQuality("searching");
          }
        }
        return;
      }
      framePending.current = false;
      latestFrame.current = message.frame;
      if (!readyRef.current) setReadyState(true);
      if (qualityRef.current !== message.frame.quality) {
        qualityRef.current = message.frame.quality;
        setQuality(message.frame.quality);
      }
      const counter = fpsCounter.current;
      counter.count += 1;
      const now = performance.now();
      if (now - counter.started >= 1000) {
        setFps(Math.round((counter.count * 1000) / (now - counter.started)));
        fpsCounter.current = { count: 0, started: now };
      }
    };
    const init: VisionWorkerInMessage = {
      type: "init",
      baseUrl: window.location.origin,
    };
    visionWorker.postMessage(init);
    return () => {
      visionWorker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    latestFrame.current = null;
    readyRef.current = false;
    setReady(false);
    qualityRef.current = "loading";
    setQuality(qualityRef.current);
    fpsCounter.current = { count: 0, started: performance.now() };
    setFps(0);
    const message: VisionWorkerInMessage = { type: "set-mode", mode };
    workerRef.current?.postMessage(message);
  }, [mode]);

  useEffect(() => {
    if (!warmFace) return;
    const message: VisionWorkerInMessage = { type: "warm-face" };
    workerRef.current?.postMessage(message);
  }, [warmFace]);

  useEffect(() => {
    if (!stream || mode === "off") return;
    let frameId = 0;
    let cancelled = false;
    let lastSubmitted = 0;

    const tick = async (now: number) => {
      const video = videoRef.current;
      if (
        !cancelled &&
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !framePending.current &&
        now - lastSubmitted >= 33
      ) {
        framePending.current = true;
        lastSubmitted = now;
        try {
          const bitmap = await captureVideoFrame(video, fallbackCanvasRef);
          if (cancelled || modeRef.current === "off") {
            bitmap.close();
            framePending.current = false;
          } else {
            const message: VisionWorkerInMessage = {
              type: "frame",
              bitmap,
              timestamp: now,
            };
            workerRef.current?.postMessage(message, [bitmap]);
          }
        } catch (reason) {
          framePending.current = false;
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not read a camera frame.",
          );
        }
      }
      if (!cancelled) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      framePending.current = false;
    };
  }, [mode, stream, videoRef]);

  return { latestFrame, quality, ready, fps, error };
}
