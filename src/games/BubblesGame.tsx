import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { bubblePoints } from "../lib/gameLogic";
import { distance } from "../lib/tracking/math";
import type { GameResult, Point, TrackingFrame } from "../types";
import { createBubbleRenderer, type ShaderBubble } from "./bubbleShader";

interface Bubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  hue: number;
  bonus: boolean;
  wobble: number;
  poppedAt: number | null;
}

interface TapRing {
  point: Point;
  startedAt: number;
  hit: boolean;
}

interface BubblePointer {
  point: Point;
  tap: boolean;
  tapStrength: number;
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const DURATION = 45_000;

function bubblePointers(frame: TrackingFrame | null): BubblePointer[] {
  if (!frame) return [];
  if (frame.hands.length > 0) {
    return frame.hands.map((hand) => ({
      point: hand.index,
      tap: hand.tap,
      tapStrength: hand.tapStrength,
    }));
  }
  return frame.hand
    ? [
        {
          point: frame.hand.index,
          tap: frame.hand.tap,
          tapStrength: frame.hand.tapStrength,
        },
      ]
    : [];
}

export function BubblesGame({
  tracking,
  paused,
  soundEnabled,
  reducedMotion,
  onFinish,
}: Props) {
  const shaderCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const finishRef = useRef(onFinish);
  const soundRef = useRef(soundEnabled);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [seconds, setSeconds] = useState(45);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const shaderCanvas = shaderCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!shaderCanvas || !overlayCanvas) return;
    const overlay = overlayCanvas.getContext("2d");
    if (!overlay) return;
    let renderer: ReturnType<typeof createBubbleRenderer> = null;
    try {
      renderer = createBubbleRenderer(shaderCanvas);
    } catch {
      renderer = null;
    }

    let animationId = 0;
    let nextId = 1;
    let bubbles: Bubble[] = [];
    let tapRings: TapRing[] = [];
    let scoreValue = 0;
    let comboValue = 0;
    let hits = 0;
    let spawned = 0;
    let start = performance.now();
    let previousTime = start;
    let lastSpawn = start - 1000;
    let pauseStarted = 0;
    let completed = false;
    let lastClockSecond = 45;
    let lastTapFrame = -1;

    const resize = () => {
      const rect = overlayCanvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      overlayCanvas.width = Math.round(rect.width * ratio);
      overlayCanvas.height = Math.round(rect.height * ratio);
      overlay.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderer?.resize(rect.width, rect.height, ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(overlayCanvas);
    resize();

    const spawn = (elapsed: number) => {
      const bonus = Math.random() < 0.12;
      bubbles.push({
        id: nextId++,
        x: 0.09 + Math.random() * 0.82,
        y: 1.1,
        radius: bonus ? 0.038 : 0.048 + Math.random() * 0.018,
        speed: 0.06 + Math.random() * 0.028 + (elapsed / DURATION) * 0.045,
        hue: Math.random(),
        bonus,
        wobble: Math.random() * Math.PI * 2,
        poppedAt: null,
      });
      spawned += 1;
    };

    const finish = (now: number) => {
      if (completed) return;
      completed = true;
      finishRef.current({
        gameId: "bubbles",
        score: scoreValue,
        accuracy: spawned ? Math.round((hits / spawned) * 100) : 0,
        durationMs: Math.min(now - start, DURATION),
        completedAt: new Date().toISOString(),
        detail: `${hits} bubble${hits === 1 ? "" : "s"} popped`,
      });
    };

    const drawFallbackBubble = (
      bubble: ShaderBubble,
      width: number,
      height: number,
    ) => {
      const radius = bubble.radius * height;
      const x = bubble.x * width;
      const y = bubble.y * height;
      const gradient = overlay.createRadialGradient(
        x - radius * 0.35,
        y - radius * 0.4,
        radius * 0.08,
        x,
        y,
        radius,
      );
      gradient.addColorStop(0, "oklch(1 0 0 / 0.95)");
      gradient.addColorStop(
        0.55,
        `oklch(0.84 0.12 ${bubble.hue * 360} / 0.12)`,
      );
      gradient.addColorStop(
        0.86,
        `oklch(0.7 0.18 ${(bubble.hue * 360 + 120) % 360} / 0.38)`,
      );
      gradient.addColorStop(1, "oklch(1 0 0 / 0.05)");
      overlay.beginPath();
      overlay.arc(x, y, radius, 0, Math.PI * 2);
      overlay.fillStyle = gradient;
      overlay.fill();
      overlay.strokeStyle = "oklch(0.543 0.073 227.629 / 0.3)";
      overlay.lineWidth = 1.5;
      overlay.stroke();
    };

    const drawOverlay = (now: number, shaderBubbles: ShaderBubble[]) => {
      const { width, height } = overlayCanvas.getBoundingClientRect();
      overlay.clearRect(0, 0, width, height);
      if (!renderer)
        shaderBubbles.forEach((bubble) =>
          drawFallbackBubble(bubble, width, height),
        );

      tapRings = tapRings.filter((ring) => now - ring.startedAt < 420);
      for (const ring of tapRings) {
        const progress = Math.min(1, (now - ring.startedAt) / 420);
        const radius = 11 + progress * (ring.hit ? 44 : 30);
        overlay.beginPath();
        overlay.arc(
          ring.point.x * width,
          ring.point.y * height,
          radius,
          0,
          Math.PI * 2,
        );
        overlay.strokeStyle = ring.hit
          ? `oklch(0.199 0 0 / ${0.5 * (1 - progress)})`
          : `oklch(0.511 0 0 / ${0.25 * (1 - progress)})`;
        overlay.lineWidth = 2.5 * (1 - progress) + 0.5;
        overlay.stroke();
        if (!reducedMotion && ring.hit) {
          for (let index = 0; index < 10; index += 1) {
            const angle = (index / 10) * Math.PI * 2 + ring.startedAt;
            const travel = progress * 52;
            overlay.beginPath();
            overlay.arc(
              ring.point.x * width + Math.cos(angle) * travel,
              ring.point.y * height + Math.sin(angle) * travel,
              Math.max(0.5, 3 * (1 - progress)),
              0,
              Math.PI * 2,
            );
            overlay.fillStyle = `oklch(0.68 0.17 ${index * 36} / ${0.7 * (1 - progress)})`;
            overlay.fill();
          }
        }
      }

      const pointers = bubblePointers(tracking.current);
      for (const pointer of pointers) {
        const x = pointer.point.x * width;
        const y = pointer.point.y * height;
        const pulse = pointer.tap ? 1.25 + pointer.tapStrength * 0.45 : 1;
        overlay.beginPath();
        overlay.arc(x, y, 8 * pulse, 0, Math.PI * 2);
        overlay.fillStyle = "oklch(0.205 0 0)";
        overlay.fill();
        overlay.lineWidth = 3;
        overlay.strokeStyle = "oklch(1 0 0)";
        overlay.stroke();
      }
    };

    const frame = (now: number) => {
      if (completed) return;
      if (pausedRef.current) {
        if (!pauseStarted) pauseStarted = now;
        animationId = requestAnimationFrame(frame);
        return;
      }
      if (pauseStarted) {
        const pausedFor = now - pauseStarted;
        start += pausedFor;
        previousTime += pausedFor;
        lastSpawn += pausedFor;
        pauseStarted = 0;
      }
      const elapsed = now - start;
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const remaining = Math.max(0, Math.ceil((DURATION - elapsed) / 1000));
      if (remaining !== lastClockSecond) {
        lastClockSecond = remaining;
        setSeconds(remaining);
      }
      if (elapsed >= DURATION) {
        finish(now);
        return;
      }

      const spawnInterval = 900 - (elapsed / DURATION) * 340;
      if (now - lastSpawn >= spawnInterval) {
        spawn(elapsed);
        lastSpawn = now;
      }
      bubbles.forEach((bubble) => {
        if (bubble.poppedAt === null) bubble.y -= bubble.speed * delta;
      });

      const trackingFrame = tracking.current;
      const tappingPointers = bubblePointers(trackingFrame).filter(
        (pointer) => pointer.tap,
      );
      if (
        tappingPointers.length &&
        trackingFrame &&
        trackingFrame.timestamp !== lastTapFrame
      ) {
        lastTapFrame = trackingFrame.timestamp;
        let scoreChanged = false;
        for (const pointer of tappingPointers) {
          const candidates = bubbles.filter(
            (bubble) =>
              bubble.poppedAt === null &&
              distance(pointer.point, bubble) <= bubble.radius * 1.28,
          );
          const hit = candidates.reduce<Bubble | null>((closest, bubble) => {
            if (!closest) return bubble;
            return distance(pointer.point, bubble) <
              distance(pointer.point, closest)
              ? bubble
              : closest;
          }, null);
          tapRings.push({
            point: { ...pointer.point },
            startedAt: now,
            hit: Boolean(hit),
          });
          if (!hit) continue;

          hit.poppedAt = now;
          hits += 1;
          comboValue = Math.min(comboValue + 1, 8);
          scoreValue += bubblePoints(hit.bonus, comboValue);
          scoreChanged = true;
          playSound(soundRef.current, hit.bonus ? "bonus-pop" : "bubble-pop", {
            detune: hit.bonus ? 0 : comboValue * 22,
          });
        }
        if (scoreChanged) {
          setScore(scoreValue);
          setCombo(comboValue);
        }
      }

      const missed = bubbles.some(
        (bubble) => bubble.poppedAt === null && bubble.y < -0.14,
      );
      if (missed) {
        comboValue = 0;
        setCombo(0);
      }
      bubbles = bubbles.filter((bubble) => {
        if (bubble.poppedAt !== null) return now - bubble.poppedAt < 520;
        return bubble.y >= -0.14;
      });

      const shaderBubbles = bubbles.map<ShaderBubble>((bubble) => ({
        x:
          bubble.x +
          (reducedMotion ? 0 : Math.sin(now / 700 + bubble.wobble) * 0.008),
        y: bubble.y,
        radius: bubble.radius,
        hue: bubble.hue,
        bonus: bubble.bonus,
        popProgress:
          bubble.poppedAt === null
            ? -1
            : Math.min(1, (now - bubble.poppedAt) / 520),
      }));
      renderer?.render(shaderBubbles, now / 1000);
      drawOverlay(now, shaderBubbles);
      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer?.dispose();
    };
  }, [reducedMotion, tracking]);

  return (
    <div className="game-stage">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div
          className={combo > 1 ? "combo-pill combo-pill--active" : "combo-pill"}
        >
          ×{Math.max(combo, 1)} combo
        </div>
        <div>
          <span>Time</span>
          <strong>{seconds}s</strong>
        </div>
      </div>
      <div className="bubble-playfield">
        <canvas
          ref={shaderCanvasRef}
          className="bubble-shader"
          aria-hidden="true"
        />
        <canvas
          ref={overlayCanvasRef}
          className="bubble-overlay"
          aria-label="Pop the Bubbles game area"
        />
        <div className="air-tap-hint">
          <span /> Aim one or both index fingers, then poke toward the camera
        </div>
      </div>
    </div>
  );
}
