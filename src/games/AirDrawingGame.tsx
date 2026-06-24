import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { distance } from "../lib/tracking/math";
import type { GameResult, Point, TrackingFrame } from "../types";

interface Stroke {
  color: string;
  points: Point[];
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  paused: boolean;
  soundEnabled: boolean;
  onFinish: (result: GameResult) => void;
}

const DURATION = 60_000;
const PALETTE = [
  "oklch(0.705 0.319 328.327)",
  "oklch(0.644 0.123 227.245)",
  "oklch(0.817 0.14 80.096)",
  "oklch(0.643 0.094 139.085)",
  "oklch(0.746 0.263 328.069)",
  "oklch(0.205 0 0)",
];
const CLEAR_HOLD_MS = 700;
const MIN_POINT_GAP = 0.005;
const GRID_W = 40;
const GRID_H = 22;
const COVERAGE_TARGET = 240;
const PROMPTS = [
  "a happy house",
  "your favorite animal",
  "a rocket ship",
  "a big tree",
  "the sun and clouds",
  "a smiling face",
];

export function AirDrawingGame({
  tracking,
  paused,
  soundEnabled,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const finishRef = useRef(onFinish);
  const promptRef = useRef(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [seconds, setSeconds] = useState(60);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);

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
    let strokes: Stroke[] = [];
    let current: Stroke | null = null;
    let strokeIndex = 0;
    let inkLength = 0;
    const covered = new Set<number>();
    let openSince = 0;
    let drawingState = false;
    let start = performance.now();
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
      const coverage = Math.min(
        100,
        Math.round((covered.size / COVERAGE_TARGET) * 100),
      );
      finishRef.current({
        gameId: "draw",
        score: Math.round(inkLength * 300) + strokes.length * 5,
        accuracy: coverage,
        durationMs: Math.min(now - start, DURATION),
        completedAt: new Date().toISOString(),
        detail: `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} drawn`,
      });
    };

    const addPoint = (point: Point) => {
      if (!current) return;
      const last = current.points[current.points.length - 1];
      if (last) {
        const step = distance(last, point);
        if (step < MIN_POINT_GAP) return;
        inkLength += step;
      }
      current.points.push({ ...point });
      covered.add(
        Math.floor(point.x * GRID_W) + Math.floor(point.y * GRID_H) * GRID_W,
      );
    };

    const draw = (now: number, tip: Point | null, pinch: boolean) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "oklch(1 0 0)";
      ctx.fillRect(0, 0, width, height);

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 7;
      for (const stroke of [...strokes, ...(current ? [current] : [])]) {
        if (stroke.points.length === 0) continue;
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
        for (let index = 1; index < stroke.points.length; index += 1) {
          ctx.lineTo(
            stroke.points[index].x * width,
            stroke.points[index].y * height,
          );
        }
        if (stroke.points.length === 1) {
          ctx.lineTo(
            stroke.points[0].x * width + 0.1,
            stroke.points[0].y * height,
          );
        }
        ctx.stroke();
      }

      if (tip) {
        ctx.beginPath();
        ctx.arc(tip.x * width, tip.y * height, pinch ? 11 : 8, 0, Math.PI * 2);
        ctx.fillStyle = pinch
          ? PALETTE[strokeIndex % PALETTE.length]
          : "oklch(0.205 0 0 / 0.35)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "oklch(1 0 0)";
        ctx.stroke();
        ctx.lineWidth = 7;
      }

      if (openSince) {
        const held = Math.min(1, (now - openSince) / CLEAR_HOLD_MS);
        ctx.fillStyle = "oklch(0.627 0 0)";
        ctx.font = "600 13px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          `Hold open palm to clear… ${Math.round(held * 100)}%`,
          width / 2,
          28,
        );
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
        start += now - pauseStarted;
        if (openSince) openSince += now - pauseStarted;
        pauseStarted = 0;
      }
      const elapsed = now - start;
      const remaining = Math.max(0, Math.ceil((DURATION - elapsed) / 1000));
      if (remaining !== lastClockSecond) {
        lastClockSecond = remaining;
        setSeconds(remaining);
      }
      if (elapsed >= DURATION) {
        draw(now, null, false);
        finish(now);
        return;
      }

      const hand = tracking.current?.hand;
      const tip = hand ? hand.index : null;
      const pinch = Boolean(hand?.pinch);

      if (hand?.gesture === "Open_Palm" && !pinch) {
        if (!openSince) openSince = now;
        else if (now - openSince >= CLEAR_HOLD_MS && strokes.length) {
          strokes = [];
          current = null;
          inkLength = 0;
          covered.clear();
          setStrokeCount(0);
          playSound(soundRef.current, "puzzle-reject");
          openSince = now + 400;
        }
      } else {
        openSince = 0;
      }

      if (pinch && tip) {
        if (!current) {
          current = {
            color: PALETTE[strokeIndex % PALETTE.length],
            points: [],
          };
          strokeIndex += 1;
          playSound(soundRef.current, "puzzle-grab");
        }
        addPoint(tip);
      } else if (current) {
        if (current.points.length > 0) {
          strokes.push(current);
          setStrokeCount(strokes.length);
        }
        current = null;
      }

      if (pinch !== drawingState) {
        drawingState = pinch;
        setDrawing(pinch);
      }
      draw(now, tip, pinch);
      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [tracking]);

  return (
    <div className="game-stage">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Draw</span>
          <strong>{promptRef.current}</strong>
        </div>
        <div
          className={drawing ? "combo-pill combo-pill--active" : "combo-pill"}
        >
          {strokeCount} strokes
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
          aria-label="Air Drawing game area"
        />
        <div className="air-tap-hint">
          <span /> Pinch to draw · open palm to lift · hold open palm to clear
        </div>
      </div>
    </div>
  );
}
