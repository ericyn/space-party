import { useEffect, useRef, useState, type RefObject } from "react";
import type { FaceTracking, TrackerMode, TrackingFrame } from "../types";
import {
  createHandMovementBounds,
  extendHandMovementBounds,
  faceExpressionDetected,
  handMovementProgress,
  type HandMovementBounds,
} from "../lib/calibration";

export type CalibrationStep = "idle" | "hand" | "face" | "complete";

export interface CalibrationStatus {
  step: CalibrationStep;
  progress: number;
}

interface UseCameraCalibrationOptions {
  active: boolean;
  resetKey: MediaStream | null;
  tracking: RefObject<TrackingFrame | null>;
  onTrackerModeChange: (mode: TrackerMode) => void;
}

const FACE_NEUTRAL_MS = 600;
const FACE_STABLE_MS = 300;

const emptyFace = (): FaceTracking => ({
  smile: 0,
  jawOpen: 0,
  browRaise: 0,
});

export function useCameraCalibration({
  active,
  resetKey,
  tracking,
  onTrackerModeChange,
}: UseCameraCalibrationOptions): CalibrationStatus {
  const [status, setStatus] = useState<CalibrationStatus>({
    step: "idle",
    progress: 0,
  });
  const stepRef = useRef<CalibrationStep>("idle");
  const lastFrameTimestamp = useRef(-1);
  const handBounds = useRef<HandMovementBounds | null>(null);
  const handStartedAt = useRef(0);
  const faceStartedAt = useRef(0);
  const faceStableAt = useRef(0);
  const faceNeutral = useRef<FaceTracking>(emptyFace());
  const faceSamples = useRef(0);
  const lastPublishedProgress = useRef(-1);

  useEffect(() => {
    lastFrameTimestamp.current = -1;
    handBounds.current = null;
    handStartedAt.current = 0;
    faceStartedAt.current = 0;
    faceStableAt.current = 0;
    faceNeutral.current = emptyFace();
    faceSamples.current = 0;
    lastPublishedProgress.current = -1;

    if (!active) {
      stepRef.current = "idle";
      setStatus({ step: "idle", progress: 0 });
      return;
    }

    stepRef.current = "hand";
    setStatus({ step: "hand", progress: 0 });
    onTrackerModeChange("hand");
  }, [active, onTrackerModeChange, resetKey]);

  useEffect(() => {
    if (!active) return;
    let animationFrame = 0;
    let cancelled = false;

    const publish = (step: CalibrationStep, progress: number) => {
      if (
        step !== stepRef.current ||
        Math.abs(progress - lastPublishedProgress.current) >= 0.025 ||
        progress === 1
      ) {
        stepRef.current = step;
        lastPublishedProgress.current = progress;
        setStatus({ step, progress });
      }
    };

    const readFrame = () => {
      const frame = tracking.current;
      if (!frame || frame.timestamp === lastFrameTimestamp.current) return;
      lastFrameTimestamp.current = frame.timestamp;

      if (stepRef.current === "hand" && frame.mode === "hand" && frame.hand) {
        const point = frame.hand.pointer;
        if (!handBounds.current) {
          handBounds.current = createHandMovementBounds(point);
          handStartedAt.current = frame.timestamp;
        } else {
          handBounds.current = extendHandMovementBounds(
            handBounds.current,
            point,
          );
        }

        const progress = handMovementProgress(handBounds.current);
        publish("hand", progress);
        if (progress >= 1 && frame.timestamp - handStartedAt.current >= 400) {
          stepRef.current = "face";
          lastPublishedProgress.current = -1;
          publish("face", 0);
          onTrackerModeChange("face");
        }
        return;
      }

      if (stepRef.current !== "face" || frame.mode !== "face" || !frame.face) {
        return;
      }

      if (!faceStartedAt.current) faceStartedAt.current = frame.timestamp;
      const neutralElapsed = frame.timestamp - faceStartedAt.current;
      if (neutralElapsed < FACE_NEUTRAL_MS) {
        faceSamples.current += 1;
        const count = faceSamples.current;
        const neutral = faceNeutral.current;
        neutral.smile += (frame.face.smile - neutral.smile) / count;
        neutral.jawOpen += (frame.face.jawOpen - neutral.jawOpen) / count;
        neutral.browRaise += (frame.face.browRaise - neutral.browRaise) / count;
        publish(
          "face",
          Math.min(0.25, (neutralElapsed / FACE_NEUTRAL_MS) * 0.25),
        );
        return;
      }

      if (faceExpressionDetected(frame.face, faceNeutral.current)) {
        if (!faceStableAt.current) faceStableAt.current = frame.timestamp;
        const stableElapsed = frame.timestamp - faceStableAt.current;
        const progress =
          0.25 + Math.min(0.75, (stableElapsed / FACE_STABLE_MS) * 0.75);
        publish("face", progress);
        if (stableElapsed >= FACE_STABLE_MS) {
          publish("complete", 1);
          onTrackerModeChange("hand");
        }
      } else {
        faceStableAt.current = 0;
        publish("face", 0.25);
      }
    };

    const tick = () => {
      readFrame();
      if (!cancelled) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [active, onTrackerModeChange, tracking]);

  return status;
}
