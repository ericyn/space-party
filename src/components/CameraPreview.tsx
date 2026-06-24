import { arc, motion, useAnimate } from "motion/react";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { CameraIcon } from "./Icons";

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream;
  containerRef?: RefObject<HTMLDivElement | null>;
  large?: boolean;
  hidden?: boolean;
}

export interface CameraFlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CameraFlightPreviewProps {
  stream: MediaStream;
  fromRect: CameraFlightRect;
  reducedMotion?: boolean;
  dockRef: RefObject<HTMLDivElement | null>;
  onFlightComplete: () => void;
}

export function CameraPreview({
  videoRef,
  stream,
  containerRef,
  large = false,
  hidden = false,
}: CameraPreviewProps) {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = containerRef ?? localContainerRef;

  useLayoutEffect(() => {
    const container = activeContainerRef.current;
    if (!container) return;
    container.style.removeProperty("transform");
    container.style.removeProperty("transform-origin");
    container.style.removeProperty("will-change");
  }, [activeContainerRef, large, stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream, videoRef]);

  return (
    <div
      ref={activeContainerRef}
      className={`camera-preview ${large ? "camera-preview--large" : ""} ${hidden ? "camera-preview--hidden" : ""}`}
      aria-hidden={hidden}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Mirrored live camera preview"
      />
      <CameraIcon className="camera-preview__icon" />
    </div>
  );
}

export function CameraFlightPreview({
  stream,
  fromRect,
  reducedMotion = false,
  dockRef,
  onFlightComplete,
}: CameraFlightPreviewProps) {
  const [scope, animate] = useAnimate();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const preview = scope.current;
    const dock = dockRef.current;
    if (!preview || !dock || reducedMotion) {
      onFlightComplete();
      return;
    }

    const to = dock.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = to.top + to.height / 2 - (fromRect.top + fromRect.height / 2);
    const scale = to.width / fromRect.width;
    let cancelled = false;
    let completed = false;
    let controls: { stop: () => void } | null = null;
    let fallbackTimer = 0;

    const complete = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(fallbackTimer);
      onFlightComplete();
    };

    preview.style.transformOrigin = "center";
    preview.style.willChange = "transform";

    const run = async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;

      fallbackTimer = window.setTimeout(() => {
        if (!cancelled) complete();
      }, 900);

      const playback = animate(
        preview,
        { x: dx, y: dy, scale },
        {
          duration: 0.56,
          path: arc({
            strength: 0.24,
            peak: 0.16,
            rotate: 0,
            direction: "cw",
          }),
          ease: [0.645, 0.045, 0.355, 1],
        },
      );
      controls = playback;
      await playback;
      if (cancelled) return;

      complete();
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      controls?.stop();
    };
  }, [animate, dockRef, fromRect, onFlightComplete, reducedMotion, scope]);

  return (
    <motion.div
      ref={scope}
      className="camera-preview camera-preview--flight"
      style={{
        left: fromRect.left,
        top: fromRect.top,
        width: fromRect.width,
        height: fromRect.height,
      }}
      aria-hidden="true"
    >
      <video ref={videoRef} muted playsInline />
      <CameraIcon className="camera-preview__icon" />
    </motion.div>
  );
}
