import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { distance, segmentCircleHit } from "../lib/tracking/math";
import type { GameResult, Point, TrackingFrame } from "../types";

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  bomb: boolean;
  rotation: number;
  spin: number;
  slicedAt: number | null;
  sliceAngle: number;
}

interface BladePoint {
  point: Point;
  at: number;
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const DURATION = 60_000;
const GRAVITY = 0.95;
const START_LIVES = 3;
const BLADE_LIFETIME = 220;
const SLICE_SPEED = 0.013;

export function FruitSlicerGame({
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
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [seconds, setSeconds] = useState(60);

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
    let fruits: Fruit[] = [];
    let blade: BladePoint[] = [];
    let prevTip: Point | null = null;
    let lastTipTimestamp = -1;
    let scoreValue = 0;
    let comboValue = 0;
    let comboExpires = 0;
    let livesValue = START_LIVES;
    let slicedCount = 0;
    let fruitSpawned = 0;
    let start = performance.now();
    let previousTime = start;
    let lastSpawn = start - 700;
    let pauseStarted = 0;
    let completed = false;
    let lastClockSecond = 60;

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
        gameId: "fruit",
        score: scoreValue,
        accuracy: fruitSpawned
          ? Math.round((slicedCount / fruitSpawned) * 100)
          : 0,
        durationMs: Math.min(now - start, DURATION),
        completedAt: new Date().toISOString(),
        detail: `${slicedCount} fruit sliced`,
      });
    };

    const spawn = (elapsed: number) => {
      const volley = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let index = 0; index < volley; index += 1) {
        const bomb = Math.random() < 0.13;
        const fromLeft = Math.random() < 0.5;
        const x = fromLeft
          ? 0.12 + Math.random() * 0.28
          : 0.6 + Math.random() * 0.28;
        fruits.push({
          id: nextId++,
          x,
          y: 1.08,
          vx: (fromLeft ? 1 : -1) * (0.04 + Math.random() * 0.09),
          vy: -(0.82 + Math.random() * 0.16 + (elapsed / DURATION) * 0.08),
          radius: bomb ? 0.05 : 0.052 + Math.random() * 0.016,
          hue: Math.random(),
          bomb,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 3,
          slicedAt: null,
          sliceAngle: 0,
        });
        if (!bomb) fruitSpawned += 1;
      }
    };

    const sliceFruit = (fruit: Fruit, now: number, angle: number) => {
      fruit.slicedAt = now;
      fruit.sliceAngle = angle;
      if (fruit.bomb) {
        livesValue -= 1;
        setLives(livesValue);
        comboValue = 0;
        setCombo(0);
        playSound(soundRef.current, "miss");
        return;
      }
      slicedCount += 1;
      if (now > comboExpires) comboValue = 0;
      comboValue = Math.min(comboValue + 1, 6);
      comboExpires = now + 1100;
      scoreValue += 10 * Math.min(comboValue, 5);
      setScore(scoreValue);
      setCombo(comboValue);
      playSound(
        soundRef.current,
        comboValue >= 4 ? "bonus-pop" : "bubble-pop",
        {
          detune: comboValue * 30,
        },
      );
    };

    const drawFruit = (fruit: Fruit, width: number, height: number) => {
      const x = fruit.x * width;
      const y = fruit.y * height;
      const radius = fruit.radius * height;
      const sliced = fruit.slicedAt !== null;
      const progress = sliced
        ? Math.min(1, (performance.now() - (fruit.slicedAt ?? 0)) / 500)
        : 0;
      ctx.save();
      ctx.globalAlpha = sliced ? 1 - progress : 1;
      const halves = sliced ? 2 : 1;
      for (let half = 0; half < halves; half += 1) {
        ctx.save();
        if (sliced) {
          const offset = progress * radius * 1.3 * (half === 0 ? -1 : 1);
          ctx.translate(
            x + Math.cos(fruit.sliceAngle + Math.PI / 2) * offset,
            y + Math.sin(fruit.sliceAngle + Math.PI / 2) * offset,
          );
        } else {
          ctx.translate(x, y);
        }
        ctx.rotate(fruit.rotation);
        ctx.beginPath();
        if (sliced) {
          const a = fruit.sliceAngle - fruit.rotation;
          ctx.arc(
            0,
            0,
            radius,
            a + (half === 0 ? 0 : Math.PI),
            a + (half === 0 ? Math.PI : Math.PI * 2),
          );
          ctx.closePath();
        } else {
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
        }
        if (fruit.bomb) {
          ctx.fillStyle = "oklch(0.261 0.024 267.11)";
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "oklch(0.413 0.03 267.496)";
          ctx.stroke();
        } else {
          const gradient = ctx.createRadialGradient(
            -radius * 0.3,
            -radius * 0.35,
            radius * 0.1,
            0,
            0,
            radius,
          );
          gradient.addColorStop(0, `oklch(0.82 0.145 ${fruit.hue * 360})`);
          gradient.addColorStop(
            1,
            `oklch(0.62 0.19 ${(fruit.hue * 360 + 28) % 360})`,
          );
          ctx.fillStyle = gradient;
          ctx.fill();
          if (sliced) {
            ctx.fillStyle = `oklch(0.95 0.045 ${fruit.hue * 360} / 0.85)`;
            ctx.beginPath();
            const a = fruit.sliceAngle - fruit.rotation;
            ctx.arc(
              0,
              0,
              radius * 0.74,
              a + (half === 0 ? 0 : Math.PI),
              a + (half === 0 ? Math.PI : Math.PI * 2),
            );
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      }
      if (fruit.bomb && !sliced) {
        ctx.strokeStyle = "oklch(0.704 0.131 61.87)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y - radius);
        ctx.quadraticCurveTo(
          x + radius * 0.5,
          y - radius * 1.5,
          x + radius * 0.8,
          y - radius * 1.2,
        );
        ctx.stroke();
      }
      ctx.restore();
    };

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "oklch(0.977 0 0)";
      ctx.fillRect(0, 0, width, height);

      for (const fruit of fruits) drawFruit(fruit, width, height);

      if (!reducedMotion) {
        const live = blade.filter((entry) => now - entry.at < BLADE_LIFETIME);
        for (let index = 1; index < live.length; index += 1) {
          const previous = live[index - 1];
          const current = live[index];
          const fade = 1 - (now - current.at) / BLADE_LIFETIME;
          ctx.beginPath();
          ctx.moveTo(previous.point.x * width, previous.point.y * height);
          ctx.lineTo(current.point.x * width, current.point.y * height);
          ctx.strokeStyle = `oklch(0.205 0 0 / ${0.35 * fade})`;
          ctx.lineWidth = 9 * fade + 1;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      const hand = tracking.current?.hand;
      if (hand) {
        ctx.beginPath();
        ctx.arc(hand.index.x * width, hand.index.y * height, 9, 0, Math.PI * 2);
        ctx.fillStyle = "oklch(0.205 0 0)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "oklch(1 0 0)";
        ctx.stroke();
      }

      ctx.fillStyle = "oklch(0.705 0.319 328.327)";
      ctx.font = "600 22px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(
        "♥".repeat(livesValue) + "♡".repeat(START_LIVES - livesValue),
        width - 18,
        34,
      );
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
        lastSpawn += pausedFor;
        comboExpires += pausedFor;
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
      if (elapsed >= DURATION || livesValue <= 0) {
        draw(now);
        finish(now);
        return;
      }

      const spawnInterval = 1050 - (elapsed / DURATION) * 430;
      if (now - lastSpawn >= spawnInterval) {
        spawn(elapsed);
        lastSpawn = now;
      }

      for (const fruit of fruits) {
        if (fruit.slicedAt !== null) continue;
        fruit.x += fruit.vx * delta;
        fruit.y += fruit.vy * delta;
        fruit.vy += GRAVITY * delta;
        fruit.rotation += fruit.spin * delta;
      }

      if (comboValue > 0 && now > comboExpires) {
        comboValue = 0;
        setCombo(0);
      }

      const frameData = tracking.current;
      const hand = frameData?.hand;
      if (hand && frameData && frameData.timestamp !== lastTipTimestamp) {
        const tip = hand.index;
        if (prevTip) {
          blade.push({ point: { ...tip }, at: now });
          const speed = distance(prevTip, tip);
          if (speed > SLICE_SPEED) {
            const angle = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);
            for (const fruit of fruits) {
              if (fruit.slicedAt !== null) continue;
              if (
                segmentCircleHit(
                  prevTip,
                  tip,
                  { x: fruit.x, y: fruit.y },
                  fruit.radius * 1.15,
                )
              ) {
                sliceFruit(fruit, now, angle);
              }
            }
          }
        }
        prevTip = { ...tip };
        lastTipTimestamp = frameData.timestamp;
      } else if (!hand) {
        prevTip = null;
      }

      blade = blade.filter((entry) => now - entry.at < BLADE_LIFETIME);
      fruits = fruits.filter((fruit) => {
        if (fruit.slicedAt !== null) return now - fruit.slicedAt < 520;
        return fruit.y < 1.2;
      });

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
          ref={canvasRef}
          className="bubble-overlay"
          aria-label="Fruit Slicer game area"
        />
        <div className="air-tap-hint">
          <span /> Swipe through the fruit, dodge the bombs · {lives} lives
        </div>
      </div>
    </div>
  );
}
