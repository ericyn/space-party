import type { FaceTracking, Point } from "../types";

export const HAND_MOVEMENT_TARGET = 0.22;

export interface HandMovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function createHandMovementBounds(point: Point): HandMovementBounds {
  return {
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y,
  };
}

export function extendHandMovementBounds(
  bounds: HandMovementBounds,
  point: Point,
): HandMovementBounds {
  return {
    minX: Math.min(bounds.minX, point.x),
    maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxY: Math.max(bounds.maxY, point.y),
  };
}

export function handMovementProgress(bounds: HandMovementBounds): number {
  const distance = Math.hypot(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
  );
  return Math.min(1, distance / HAND_MOVEMENT_TARGET);
}

export function faceExpressionDetected(
  face: FaceTracking,
  neutral: FaceTracking,
): boolean {
  const smiled = face.smile > 0.48 && face.smile - neutral.smile > 0.18;
  const openedMouth =
    face.jawOpen > 0.48 && face.jawOpen - neutral.jawOpen > 0.2;
  const raisedBrows =
    face.browRaise > 0.38 && face.browRaise - neutral.browRaise > 0.13;
  return smiled || openedMouth || raisedBrows;
}
