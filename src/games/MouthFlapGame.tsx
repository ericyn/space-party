import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { clamp } from "../lib/tracking/math";
import type { GameResult, TrackingFrame } from "../types";

interface Gate {
  id: number;
  x: number;
  gapCenter: number;
  gapHalf: number;
  scored: boolean;
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const TIME_CAP = 90_000;
const START_LIVES = 3;
const BIRD_X = 0.28;
const BIRD_RADIUS = 0.042;
const GRAVITY = 1.45;
const FLAP_ACCEL = 2.6;
const MAX_FALL = 0.95;
const JAW_OPEN_THRESHOLD = 0.3;
const INVULN_MS = 1000;

export function MouthFlapGame({
  tracking,
  paused,
  soundEnabled,
  reducedMotion,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const finishRef = useRef(onFinish);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [open, setOpen] = useState(false);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let nextId = 1;
    let gates: Gate[] = [];
    let birdY = 0.45;
    let velocity = 0;
    let scoreValue = 0;
    let hits = 0;
    let livesValue = START_LIVES;
    let mouthOpen = false;
    let invulnUntil = 0;
    let start = performance.now();
    let previousTime = start;
    let pauseStarted = 0;
    let completed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const finish = (now: number) => {
      if (completed) return;
      completed = true;
      finishRef.current({
        gameId: "flap",
        score: scoreValue,
        accuracy: Math.round(
          (scoreValue / Math.max(scoreValue + hits, 1)) * 100,
        ),
        durationMs: now - start,
        completedAt: new Date().toISOString(),
        detail: `${scoreValue} gate${scoreValue === 1 ? "" : "s"} cleared`,
      });
    };

    const reset = (now: number) => {
      birdY = 0.45;
      velocity = 0;
      invulnUntil = now + INVULN_MS;
      gates = gates.filter(
        (gate) => gate.x > BIRD_X + 0.35 || gate.x < BIRD_X - 0.2,
      );
    };

    const speed = () => 0.2 + Math.min(0.12, scoreValue * 0.004);

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "oklch(0.977 0 0)";
      ctx.fillRect(0, 0, width, height);

      for (const gate of gates) {
        const gx = gate.x * width;
        const topH = (gate.gapCenter - gate.gapHalf) * height;
        const bottomY = (gate.gapCenter + gate.gapHalf) * height;
        const gateWidth = 0.11 * width;
        ctx.fillStyle = "oklch(0.643 0.094 139.085)";
        ctx.strokeStyle = "oklch(0.539 0.081 139.589)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(gx - gateWidth / 2, -4, gateWidth, topH + 4, 10);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(
          gx - gateWidth / 2,
          bottomY,
          gateWidth,
          height - bottomY + 4,
          10,
        );
        ctx.fill();
        ctx.stroke();
      }

      const bx = BIRD_X * width;
      const by = birdY * height;
      const radius = BIRD_RADIUS * height;
      const blinking = now < invulnUntil && Math.floor(now / 120) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = blinking ? 0.4 : 1;
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fillStyle = "oklch(0.82 0.171 78.466)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "oklch(0.205 0 0)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        bx + radius * 0.35,
        by - radius * 0.3,
        radius * 0.22,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "oklch(0.205 0 0)";
      ctx.fill();
      ctx.beginPath();
      if (mouthOpen) {
        ctx.ellipse(
          bx + radius * 0.6,
          by + radius * 0.35,
          radius * 0.32,
          radius * 0.4,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "oklch(0.608 0.15 35.115)";
        ctx.fill();
      } else {
        ctx.moveTo(bx + radius * 0.25, by + radius * 0.4);
        ctx.lineTo(bx + radius * 0.95, by + radius * 0.4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "oklch(0.205 0 0)";
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      if (completed) return;
      if (pausedRef.current) {
        if (!pauseStarted) pauseStarted = now;
        draw(now);
        animationId = requestAnimationFrame(frame);
        return;
      }
      if (pauseStarted) {
        const pausedFor = now - pauseStarted;
        start += pausedFor;
        previousTime += pausedFor;
        invulnUntil += pausedFor;
        pauseStarted = 0;
      }
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;

      if (now - start >= TIME_CAP || livesValue <= 0) {
        draw(now);
        finish(now);
        return;
      }

      const face = tracking.current?.face;
      const nextOpen = (face?.jawOpen ?? 0) > JAW_OPEN_THRESHOLD;
      if (nextOpen !== mouthOpen) setOpen(nextOpen);
      mouthOpen = nextOpen;
      velocity += (mouthOpen ? -FLAP_ACCEL : GRAVITY) * delta;
      velocity = clamp(velocity, -MAX_FALL, MAX_FALL);
      birdY = clamp(birdY + velocity * delta, 0, 1);

      const gateSpeed = speed();
      for (const gate of gates) gate.x -= gateSpeed * delta;
      const rightmost = gates.length
        ? Math.max(...gates.map((gate) => gate.x))
        : -1;
      if (rightmost < 0.58) {
        gates.push({
          id: nextId++,
          x: 1.15,
          gapCenter: 0.3 + Math.random() * 0.4,
          gapHalf: 0.17,
          scored: false,
        });
      }

      const hittable = now >= invulnUntil;
      for (const gate of gates) {
        if (!gate.scored && gate.x < BIRD_X) {
          gate.scored = true;
          scoreValue += 1;
          setScore(scoreValue);
          playSound(soundRef.current, "bubble-pop");
        }
        if (hittable && Math.abs(gate.x - BIRD_X) < 0.055 + BIRD_RADIUS) {
          const outsideGap =
            birdY < gate.gapCenter - gate.gapHalf + BIRD_RADIUS ||
            birdY > gate.gapCenter + gate.gapHalf - BIRD_RADIUS;
          if (outsideGap) {
            hits += 1;
            livesValue -= 1;
            setLives(livesValue);
            playSound(soundRef.current, "miss");
            reset(now);
            break;
          }
        }
      }
      if (hittable && (birdY <= 0 || birdY >= 1)) {
        hits += 1;
        livesValue -= 1;
        setLives(livesValue);
        playSound(soundRef.current, "miss");
        reset(now);
      }

      gates = gates.filter((gate) => gate.x > -0.2);
      draw(now);
      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [reducedMotion, tracking]);

  return (
    <div className="game-stage">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Gates</span>
          <strong>{score}</strong>
        </div>
        <div className="lives" aria-label={`${lives} lives remaining`}>
          {Array.from({ length: START_LIVES }, (_, index) => (
            <span key={index} className={index < lives ? "" : "lost"}>
              ♥
            </span>
          ))}
        </div>
        <div>
          <span>Mouth</span>
          <strong>{open ? "Open" : "Closed"}</strong>
        </div>
      </div>
      <div className="bubble-playfield">
        <canvas
          ref={canvasRef}
          className="bubble-overlay"
          aria-label="Mouth Flap game area"
        />
        <div className="air-tap-hint">
          <span /> Open your mouth to fly up, close it to glide down
        </div>
      </div>
    </div>
  );
}
