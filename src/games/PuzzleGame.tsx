import { useEffect, useRef, useState } from "react";
import { playSound } from "../lib/audio";
import { puzzleScore } from "../lib/gameLogic";
import { distance } from "../lib/tracking/math";
import type { GameResult, Point, TrackingFrame } from "../types";

type Shape = "circle" | "square" | "triangle" | "diamond";

interface Piece {
  id: number;
  shape: Shape;
  color: string;
  origin: Point;
  target: Point;
  position: Point;
  placed: boolean;
  placedAt: number | null;
  snapBack: SnapBack | null;
}

interface SnapBack {
  from: Point;
  to: Point;
  startedAt: number;
}

interface Props {
  tracking: React.RefObject<TrackingFrame | null>;
  difficulty: 4 | 6 | 8;
  paused: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  onFinish: (result: GameResult) => void;
}

const COLORS = [
  "oklch(0.663 0.139 31.396)",
  "oklch(0.601 0.069 185.413)",
  "oklch(0.579 0.077 266.32)",
  "oklch(0.768 0.126 76.252)",
  "oklch(0.746 0.263 328.069)",
  "oklch(0.643 0.094 139.085)",
  "oklch(0.656 0.109 46.817)",
  "oklch(0.623 0.05 224.692)",
];
const SHAPES: Shape[] = ["circle", "square", "triangle", "diamond"];
const LIMIT = 90_000;
const GRAB_RADIUS = 0.09;
const PLACE_RADIUS = 0.16;
const MAGNET_RADIUS = 0.24;
const MAGNET_PULL = 0.68;
const SNAP_BACK_MS = 620;

function makePieces(count: 4 | 6 | 8): Piece[] {
  return Array.from({ length: count }, (_, index) => {
    const rows = count <= 4 ? 2 : count <= 6 ? 3 : 4;
    const row = index % rows;
    const column = Math.floor(index / rows);
    const yStart = count <= 4 ? 0.26 : count <= 6 ? 0.2 : 0.17;
    const yEnd = count <= 4 ? 0.74 : count <= 6 ? 0.8 : 0.83;
    const y = yStart + row * ((yEnd - yStart) / Math.max(rows - 1, 1));
    const originX = column === 0 ? 0.18 : 0.4;
    const targetX = column === 0 ? 0.62 : 0.82;
    return {
      id: index,
      shape: SHAPES[index % SHAPES.length],
      color: COLORS[index],
      origin: { x: originX, y },
      target: { x: targetX, y },
      position: { x: originX, y },
      placed: false,
      placedAt: null,
      snapBack: null,
    };
  });
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function lerpPoint(from: Point, to: Point, amount: number): Point {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
  };
}

function springProgress(progress: number): number {
  if (progress >= 1) return 1;
  return 1 - Math.exp(-7 * progress) * Math.cos(progress * 10);
}

function magnetizedPointer(pointer: Point, target: Point): Point {
  const targetDistance = distance(pointer, target);
  if (targetDistance >= MAGNET_RADIUS) return pointer;
  const pull = (1 - targetDistance / MAGNET_RADIUS) * MAGNET_PULL;
  return lerpPoint(pointer, target, pull);
}

function drawShape(
  context: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  size: number,
): void {
  context.beginPath();
  if (shape === "circle") context.arc(x, y, size, 0, Math.PI * 2);
  if (shape === "square")
    context.roundRect(x - size, y - size, size * 2, size * 2, size * 0.25);
  if (shape === "triangle") {
    context.moveTo(x, y - size * 1.12);
    context.lineTo(x + size, y + size * 0.82);
    context.lineTo(x - size, y + size * 0.82);
    context.closePath();
  }
  if (shape === "diamond") {
    context.moveTo(x, y - size * 1.15);
    context.lineTo(x + size, y);
    context.lineTo(x, y + size * 1.15);
    context.lineTo(x - size, y);
    context.closePath();
  }
}

export function PuzzleGame({
  tracking,
  difficulty,
  paused,
  soundEnabled,
  reducedMotion,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const reducedMotionRef = useRef(reducedMotion);
  const finishRef = useRef(onFinish);
  const [placed, setPlaced] = useState(0);
  const [seconds, setSeconds] = useState(90);
  const [grabs, setGrabs] = useState(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let pieces = makePieces(difficulty);
    let grabbed: Piece | null = null;
    let previousPinch = false;
    let unnecessaryGrabs = 0;
    let placedCount = 0;
    let animationId = 0;
    let start = performance.now();
    let pauseStarted = 0;
    let lastSecond = 90;
    let completed = false;
    let completionAt = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const finish = (now: number) => {
      if (completed) return;
      completed = true;
      const elapsed = Math.min(now - start, LIMIT);
      const score = puzzleScore(elapsed, unnecessaryGrabs, placedCount);
      finishRef.current({
        gameId: "puzzle",
        score,
        accuracy: Math.round(
          (placedCount / Math.max(placedCount + unnecessaryGrabs, 1)) * 100,
        ),
        durationMs: elapsed,
        completedAt: new Date().toISOString(),
        detail:
          placedCount === difficulty
            ? `${difficulty}-piece puzzle completed`
            : `${placedCount} of ${difficulty} pieces placed`,
      });
    };

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      context.clearRect(0, 0, width, height);
      context.fillStyle = "oklch(0.977 0 0)";
      context.fillRect(0, 0, width, height);
      const size =
        Math.min(width, height) *
        (difficulty === 8 ? 0.055 : difficulty === 6 ? 0.065 : 0.075);

      for (const piece of pieces) {
        const placedProgress =
          piece.placedAt === null
            ? 1
            : Math.min(1, (now - piece.placedAt) / 300);
        const settleScale =
          piece.placedAt === null
            ? 1
            : 1 + Math.sin(placedProgress * Math.PI) * 0.18;
        const targetDistance = grabbed?.id === piece.id
          ? distance(grabbed.position, piece.target)
          : Infinity;
        const magnetProgress =
          targetDistance >= MAGNET_RADIUS
            ? 0
            : 1 - targetDistance / MAGNET_RADIUS;
        drawShape(
          context,
          piece.shape,
          piece.target.x * width,
          piece.target.y * height,
          size * (1.08 + magnetProgress * 0.32) * settleScale,
        );
        context.fillStyle = piece.placed
          ? piece.color
          : `oklch(1 0 0 / ${0.45 + magnetProgress * 0.28})`;
        context.fill();
        context.strokeStyle = piece.placed
          ? "oklch(1 0 0 / 0.9)"
          : magnetProgress > 0
            ? "oklch(0.205 0 0 / 0.62)"
            : "oklch(0.833 0 0)";
        context.lineWidth = piece.placed ? 4 : magnetProgress > 0 ? 3 : 2;
        context.setLineDash(piece.placed ? [] : [5, 5]);
        context.stroke();
        context.setLineDash([]);
      }

      for (const piece of pieces) {
        if (piece.placed) continue;
        const x = piece.position.x * width;
        const y = piece.position.y * height;
        const selected = grabbed?.id === piece.id;
        context.save();
        context.shadowColor = "oklch(0 0 0 / 0.16)";
        context.shadowBlur = selected ? 22 : 6;
        context.shadowOffsetY = selected ? 10 : 2;
        drawShape(context, piece.shape, x, y, size * (selected ? 1.18 : 1));
        context.fillStyle = piece.color;
        context.fill();
        if (selected) {
          context.lineWidth = 4;
          context.strokeStyle = "oklch(1 0 0 / 0.9)";
          context.stroke();
        }
        context.restore();
      }

      const hand = tracking.current?.hand;
      if (hand) {
        const thumbX = hand.thumb.x * width;
        const thumbY = hand.thumb.y * height;
        const indexX = hand.index.x * width;
        const indexY = hand.index.y * height;
        context.beginPath();
        context.moveTo(thumbX, thumbY);
        context.lineTo(indexX, indexY);
        context.strokeStyle = hand.pinch
          ? "oklch(0.191 0 0 / 0.75)"
          : "oklch(0.191 0 0 / 0.22)";
        context.lineWidth = hand.pinch ? 3 : 2;
        context.stroke();
        const dotRadius = hand.pinch ? 12 : 9;
        context.beginPath();
        context.arc(thumbX, thumbY, dotRadius, 0, Math.PI * 2);
        context.fillStyle = "oklch(0.664 0.184 19.034)";
        context.fill();
        context.lineWidth = 3;
        context.strokeStyle = "oklch(1 0 0)";
        context.stroke();
        context.beginPath();
        context.arc(indexX, indexY, dotRadius, 0, Math.PI * 2);
        context.fillStyle = "oklch(0.205 0 0)";
        context.fill();
        context.lineWidth = 3;
        context.strokeStyle = "oklch(1 0 0)";
        context.stroke();
      }
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
        start += now - pauseStarted;
        pauseStarted = 0;
      }
      const elapsed = now - start;
      if (completionAt && now - completionAt >= 480) {
        draw(now);
        finish(now);
        return;
      }
      const remaining = Math.max(0, Math.ceil((LIMIT - elapsed) / 1000));
      if (remaining !== lastSecond) {
        lastSecond = remaining;
        setSeconds(remaining);
      }
      if (elapsed >= LIMIT) {
        draw(now);
        finish(now);
        return;
      }

      const hand = tracking.current?.hand;
      if (hand) {
        const pointer = hand.pointer;
        if (hand.pinch && !previousPinch && !grabbed) {
          const candidates = pieces.filter(
            (piece) =>
              !piece.placed && distance(piece.position, pointer) < GRAB_RADIUS,
          );
          if (candidates.length) {
            grabbed = candidates.reduce((closest, piece) =>
              distance(piece.position, pointer) <
              distance(closest.position, pointer)
                ? piece
                : closest,
            );
            grabbed.snapBack = null;
            setGrabs((value) => value + 1);
            playSound(soundRef.current, "puzzle-grab");
          }
        }
        if (hand.pinch && grabbed) {
          grabbed.position = magnetizedPointer(pointer, grabbed.target);
        }
        if (!hand.pinch && previousPinch && grabbed) {
          if (distance(grabbed.position, grabbed.target) < PLACE_RADIUS) {
            grabbed.position = { ...grabbed.target };
            grabbed.placed = true;
            grabbed.placedAt = now;
            grabbed.snapBack = null;
            placedCount += 1;
            setPlaced(placedCount);
            playSound(soundRef.current, "puzzle-place");
          } else {
            if (reducedMotionRef.current) {
              grabbed.position = { ...grabbed.origin };
            } else {
              grabbed.snapBack = {
                from: { ...grabbed.position },
                to: { ...grabbed.origin },
                startedAt: now,
              };
            }
            unnecessaryGrabs += 1;
            playSound(soundRef.current, "puzzle-reject");
          }
          grabbed = null;
          if (placedCount === difficulty) {
            completionAt = now;
          }
        }
        previousPinch = hand.pinch;
      } else {
        previousPinch = false;
      }

      for (const piece of pieces) {
        if (!piece.snapBack || piece.placed || grabbed?.id === piece.id) {
          continue;
        }
        const progress = Math.min(
          1,
          (now - piece.snapBack.startedAt) / SNAP_BACK_MS,
        );
        piece.position = lerpPoint(
          piece.snapBack.from,
          piece.snapBack.to,
          springProgress(progress),
        );
        if (progress >= 1) {
          piece.position = { ...piece.snapBack.to };
          piece.snapBack = null;
        }
      }
      draw(now);
      animationId = requestAnimationFrame(frame);
    };

    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      pieces = [];
    };
  }, [difficulty, tracking]);

  return (
    <div className="game-stage">
      <div className="game-hud" aria-live="polite">
        <div>
          <span>Placed</span>
          <strong>
            {placed}/{difficulty}
          </strong>
        </div>
        <div className="combo-pill">
          {grabs} grab{grabs === 1 ? "" : "s"}
        </div>
        <div>
          <span>Time</span>
          <strong>{seconds}s</strong>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Pinch Puzzle game area"
      />
    </div>
  );
}
