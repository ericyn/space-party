import type { GameId, Point } from "../types";
import { clamp } from "./tracking/math";

export interface TargetCandidate {
  id: GameId;
  rect: DOMRect;
}

export function viewportPointFromAim(
  aim: Point,
  viewport: { width: number; height: number },
): Point {
  return {
    x: clamp(aim.x, 0, 1) * viewport.width,
    y: clamp(aim.y, 0, 1) * viewport.height,
  };
}

export function findPointTarget(
  point: Point,
  candidates: TargetCandidate[],
  padding = 68,
): GameId | null {
  let best: { id: GameId; distance: number } | null = null;

  for (const candidate of candidates) {
    const rect = candidate.rect;
    const left = rect.left - padding;
    const right = rect.right + padding;
    const top = rect.top - padding;
    const bottom = rect.bottom + padding;

    if (
      point.x < left ||
      point.x > right ||
      point.y < top ||
      point.y > bottom
    ) {
      continue;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(point.x - centerX, point.y - centerY);
    if (!best || distance < best.distance) {
      best = { id: candidate.id, distance };
    }
  }

  return best?.id ?? null;
}
