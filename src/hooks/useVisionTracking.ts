import { useEffect, useRef, useState } from "react";
import type {
  TrackerMode,
  TrackingFrame,
  TrackingQuality,
  VisionWorkerInMessage,
  VisionWorkerOutMessage,
} from "../types";

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
  const [fps, setFps] = useState(0);
  const [error, setError] = useState("");
  const fpsCounter = useRef({ count: 0, started: performance.now() });

  useEffect(() => {
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
        qualityRef.current = "error";
        setQuality("error");
        return;
      }
      if (message.type === "ready") {
        setError("");
        return;
      }
      framePending.current = false;
      latestFrame.current = message.frame;
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
    qualityRef.current = mode === "off" ? "loading" : "searching";
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
          const bitmap = await createImageBitmap(video, {
            resizeWidth: 640,
            resizeHeight: 360,
            resizeQuality: "low",
          });
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

  return { latestFrame, quality, fps, error };
}
