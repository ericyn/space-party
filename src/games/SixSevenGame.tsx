import { useEffect, useRef, useState, type CSSProperties } from "react";
import { playSound } from "../lib/audio";
import type { GameResult, HandSample, Point, TrackingFrame } from "../types";

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const ROUND = 20_000;
const ARM_SWITCH_THRESHOLD = 0.14;
const MIN_SWITCH_MS = 150;

type HighArm = "left" | "right";

interface ArmPoint extends Point {
  side: HighArm;
}

function armPoint(hand: HandSample): Point {
  return hand.wrist ?? hand.point;
}

function sortedArmPoints(hands: HandSample[]): [ArmPoint, ArmPoint] | null {
  if (hands.length < 2) return null;
  const sorted = [...hands].sort((a, b) => armPoint(a).x - armPoint(b).x);
  const left = armPoint(sorted[0]);
  const right = armPoint(sorted[sorted.length - 1]);
  return [
    { ...left, side: "left" },
    { ...right, side: "right" },
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
  return "6 7";
}

export function SixSevenGame({
  tracking,
  paused,
  soundEnabled,
  reducedMotion,
  onFinish,
}: Props) {
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const finishRef = useRef(onFinish);
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(20);
  const [arms, setArms] = useState<[ArmPoint, ArmPoint] | null>(null);
  const [activeArm, setActiveArm] = useState<HighArm | null>(null);
  const [labelPulse, setLabelPulse] = useState(0);

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
      <div className="sixseven-overlay" aria-label="Doing the 6 7 game area">
        <div className="sixseven-zone sixseven-zone--top">
          <span>Up</span>
        </div>
        <div className="sixseven-zone sixseven-zone--bottom">
          <span>Down</span>
        </div>
        <div
          key={labelPulse}
          className={`sixseven-label ${arms ? "" : "sixseven-label--waiting"} ${reducedMotion ? "sixseven-label--static" : ""}`}
        >
          {label}
        </div>
        {arms
          ? arms.map((arm) => (
              <div
                key={arm.side}
                className={`sixseven-arm-point sixseven-arm-point--${arm.side} ${
                  activeArm === arm.side ? "sixseven-arm-point--active" : ""
                }`}
                style={
                  {
                    "--arm-x": arm.x,
                    "--arm-y": arm.y,
                  } as CSSProperties
                }
              >
                <span />
                <b>{arm.side}</b>
              </div>
            ))
          : null}
        <div className="air-tap-hint sixseven-hint">
          <span /> Put one arm up and one down, then swap: 6, 7, 6, 7
        </div>
      </div>
    </div>
  );
}
