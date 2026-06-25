import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import type { GameResult, HandSample, Point, TrackingFrame } from "../types";

interface Props {
  stream: MediaStream | null;
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const ROUND = 20_000;
const ARM_SWITCH_THRESHOLD = 0.12;
const MIN_SWITCH_MS = 110;

type HighArm = "left" | "right";

interface ArmPoint extends Point {
  side: HighArm;
  sample: HandSample;
}

interface FrameSize {
  width: number;
  height: number;
}

function armPoint(hand: HandSample): Point {
  return hand.wrist ?? hand.point;
}

function sortedArmPoints(hands: HandSample[]): [ArmPoint, ArmPoint] | null {
  if (hands.length < 2) return null;
  const sorted = [...hands].sort((a, b) => armPoint(a).x - armPoint(b).x);
  const leftHand = sorted[0];
  const rightHand = sorted[sorted.length - 1];
  const left = armPoint(leftHand);
  const right = armPoint(rightHand);
  return [
    { ...left, side: "left", sample: leftHand },
    { ...right, side: "right", sample: rightHand },
  ];
}

function highArmFromPoints(points: [ArmPoint, ArmPoint]): HighArm | null {
  const [left, right] = points;
  const diff = right.y - left.y;
  if (diff > ARM_SWITCH_THRESHOLD) return "left";
  if (diff < -ARM_SWITCH_THRESHOLD) return "right";
  return null;
}

function labelForArm(arm: HighArm | null): string {
  if (arm === "left") return "6";
  if (arm === "right") return "7";
  return "67";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function inferredForearmPoint(hand: HandSample): Point {
  const dx = hand.wrist.x - hand.point.x;
  const dy = hand.wrist.y - hand.point.y;
  return {
    x: clamp01(hand.wrist.x + dx * 2.1),
    y: clamp01(hand.wrist.y + dy * 2.1),
  };
}

function pointInFrame(
  point: Point,
  videoSize: FrameSize,
  frameSize: FrameSize,
): Point {
  if (
    videoSize.width <= 0 ||
    videoSize.height <= 0 ||
    frameSize.width <= 0 ||
    frameSize.height <= 0
  ) {
    return { x: point.x * 100, y: point.y * 100 };
  }

  const scale = Math.max(
    frameSize.width / videoSize.width,
    frameSize.height / videoSize.height,
  );
  const renderedWidth = videoSize.width * scale;
  const renderedHeight = videoSize.height * scale;
  const offsetX = (frameSize.width - renderedWidth) / 2;
  const offsetY = (frameSize.height - renderedHeight) / 2;

  return {
    x: ((offsetX + point.x * renderedWidth) / frameSize.width) * 100,
    y: ((offsetY + point.y * renderedHeight) / frameSize.height) * 100,
  };
}

export function SixSevenGame({
  stream,
  tracking,
  paused,
  soundEnabled,
  reducedMotion,
  onFinish,
}: Props) {
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const finishRef = useRef(onFinish);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(20);
  const [arms, setArms] = useState<[ArmPoint, ArmPoint] | null>(null);
  const [activeArm, setActiveArm] = useState<HighArm | null>(null);
  const [labelPulse, setLabelPulse] = useState(0);
  const [videoSize, setVideoSize] = useState<FrameSize>({
    width: 0,
    height: 0,
  });
  const [frameSize, setFrameSize] = useState<FrameSize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const updateVideoSize = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      setVideoSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    video.srcObject = stream;
    video.addEventListener("loadedmetadata", updateVideoSize);
    void video.play().then(updateVideoSize).catch(() => undefined);

    return () => {
      video.removeEventListener("loadedmetadata", updateVideoSize);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateFrameSize = () => {
      setFrameSize((current) => {
        const width = overlay.clientWidth;
        const height = overlay.clientHeight;
        return current.width === width && current.height === height
          ? current
          : { width, height };
      });
    };

    updateFrameSize();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateFrameSize);
    observer?.observe(overlay);
    window.addEventListener("resize", updateFrameSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateFrameSize);
    };
  }, []);

  useEffect(() => {
    let animationId = 0;
    let countValue = 0;
    let sampleFrames = 0;
    let bothFrames = 0;
    let lastTimestamp = -1;
    let lastCountedArm: HighArm | null = null;
    let lastCountedAt = -Infinity;
    let start = performance.now();
    let pauseStarted = 0;
    let completed = false;
    let lastClockSecond = 20;

    const finish = (now: number) => {
      if (completed) return;
      completed = true;
      finishRef.current({
        gameId: "sixseven",
        score: countValue,
        accuracy: sampleFrames
          ? Math.round((bothFrames / sampleFrames) * 100)
          : 0,
        durationMs: Math.min(now - start, ROUND),
        completedAt: new Date().toISOString(),
        detail: `${countValue} point${countValue === 1 ? "" : "s"}`,
      });
    };

    const frame = (now: number) => {
      if (completed) return;
      if (pausedRef.current) {
        if (!pauseStarted) pauseStarted = now;
        animationId = requestAnimationFrame(frame);
        return;
      }
      if (pauseStarted) {
        start += now - pauseStarted;
        pauseStarted = 0;
      }

      const elapsed = now - start;
      const remaining = Math.max(0, Math.ceil((ROUND - elapsed) / 1000));
      if (remaining !== lastClockSecond) {
        lastClockSecond = remaining;
        setSeconds(remaining);
      }
      if (elapsed >= ROUND) {
        finish(now);
        return;
      }

      const data = tracking.current;
      if (data && data.timestamp !== lastTimestamp) {
        lastTimestamp = data.timestamp;
        sampleFrames += 1;
        const nextArms = sortedArmPoints(data.hands ?? []);
        if (!nextArms) {
          setArms(null);
          setActiveArm(null);
        } else {
          bothFrames += 1;
          setArms(nextArms);
          const nextHighArm = highArmFromPoints(nextArms);
          setActiveArm(nextHighArm);
          if (
            nextHighArm &&
            nextHighArm !== lastCountedArm &&
            now - lastCountedAt >= MIN_SWITCH_MS
          ) {
            lastCountedArm = nextHighArm;
            lastCountedAt = now;
            countValue += 1;
            setCount(countValue);
            if (!reducedMotion) setLabelPulse((value) => value + 1);
            playSound(soundRef.current, "ui-select", {
              detune: nextHighArm === "left" ? -180 : 220,
            });
          }
        }
      }

      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationId);
  }, [reducedMotion, tracking]);

  const label = labelForArm(activeArm);
  const trackedArms = arms ?? [];

  return (
    <div className="game-stage game-stage--sixseven">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Points</span>
          <strong>{count}</strong>
        </div>
        <div className={arms ? "combo-pill combo-pill--active" : "combo-pill"}>
          {arms ? "Alternate arms" : "Show both arms"}
        </div>
        <div>
          <span>Time</span>
          <strong>{seconds}s</strong>
        </div>
      </div>
      <div
        ref={overlayRef}
        className="sixseven-overlay"
        aria-label="67 game area"
      >
        {stream ? (
          <video
            ref={videoRef}
            className="sixseven-camera-video"
            muted
            playsInline
            aria-hidden="true"
          />
        ) : (
          <div className="sixseven-camera-empty" aria-hidden="true" />
        )}
        <div className="sixseven-camera-scrim" aria-hidden="true" />
        <svg
          className="sixseven-tracking-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {trackedArms.map((arm) => {
            const hand = arm.sample;
            const forearm = pointInFrame(
              inferredForearmPoint(hand),
              videoSize,
              frameSize,
            );
            const wrist = pointInFrame(hand.wrist, videoSize, frameSize);
            const palm = pointInFrame(hand.point, videoSize, frameSize);
            const thumb = pointInFrame(hand.thumb, videoSize, frameSize);
            const index = pointInFrame(hand.index, videoSize, frameSize);
            const middle = pointInFrame(hand.middle, videoSize, frameSize);
            const pinky = pointInFrame(hand.pinky, videoSize, frameSize);
            const isActive = activeArm === arm.side;

            return (
              <g
                key={arm.side}
                className={`sixseven-tracking-arm ${
                  isActive ? "sixseven-tracking-arm--active" : ""
                }`}
              >
                <line
                  className="sixseven-arm-line sixseven-arm-line--forearm"
                  x1={forearm.x}
                  y1={forearm.y}
                  x2={wrist.x}
                  y2={wrist.y}
                />
                <line
                  className="sixseven-arm-line sixseven-arm-line--forearm"
                  x1={wrist.x}
                  y1={wrist.y}
                  x2={palm.x}
                  y2={palm.y}
                />
                {[thumb, index, middle, pinky].map((finger, index) => (
                  <line
                    key={index}
                    className="sixseven-arm-line sixseven-arm-line--hand"
                    x1={palm.x}
                    y1={palm.y}
                    x2={finger.x}
                    y2={finger.y}
                  />
                ))}
                {[forearm, wrist, palm, thumb, index, middle, pinky].map(
                  (point, index) => (
                    <circle
                      key={index}
                      className={
                        index < 3
                          ? "sixseven-arm-joint"
                          : "sixseven-arm-joint sixseven-arm-joint--finger"
                      }
                      cx={point.x}
                      cy={point.y}
                      r={index < 3 ? (isActive ? 1.55 : 1.25) : 0.85}
                    />
                  ),
                )}
              </g>
            );
          })}
        </svg>
        <div
          key={labelPulse}
          className={`sixseven-label ${arms ? "" : "sixseven-label--waiting"} ${reducedMotion ? "sixseven-label--static" : ""}`}
        >
          {label}
        </div>
        <div className="air-tap-hint sixseven-hint">
          <span /> Put one arm up and one down, then swap: 6, 7, 6, 7
        </div>
      </div>
    </div>
  );
}
