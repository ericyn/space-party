import type { Point } from "../../types";

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mirrorPoint(point: Point): Point {
  return { x: 1 - point.x, y: point.y };
}

export function smoothPoint(
  previous: Point | null,
  next: Point,
  alpha = 0.35,
): Point {
  if (!previous) return next;
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
  };
}

export function nextPinchState(current: boolean, ratio: number): boolean {
  if (current) return ratio < 0.5;
  return ratio < 0.35;
}

export function segmentCircleHit(
  start: Point,
  end: Point,
  center: Point,
  radius: number,
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(start, center) <= radius;
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared,
    ),
  );
  return (
    distance(
      { x: start.x + projection * dx, y: start.y + projection * dy },
      center,
    ) <= radius
  );
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function airTapSignal(
  fingertipDepthVelocity: number,
  handScaleVelocity: number,
  millisecondsSinceLastTap: number,
): { tap: boolean; strength: number } {
  const strength = Math.max(
    fingertipDepthVelocity / 1.05,
    handScaleVelocity / 0.18,
  );
  return {
    tap: strength > 1 && millisecondsSinceLastTap > 320,
    strength: clamp(strength / 2, 0, 1),
  };
}
