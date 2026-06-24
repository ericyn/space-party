import type { Point } from "../../types";
import { clamp, mirrorPoint, smoothPoint } from "./math";

export interface FaceAimLandmark {
  x: number;
  y: number;
}

const NOSE_TIP = 1;

function landmarkBounds(landmarks: FaceAimLandmark[]) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }

  return {
    center: mirrorPoint({
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2,
    }),
    width: Math.max(maxX - minX, 0.001),
    height: Math.max(maxY - minY, 0.001),
  };
}

export function estimateFaceAim(landmarks: FaceAimLandmark[]): Point | null {
  const nose = landmarks[NOSE_TIP];
  if (!nose || landmarks.length < 20) return null;

  const bounds = landmarkBounds(landmarks);
  const mirroredNose = mirrorPoint(nose);
  const yaw = (mirroredNose.x - bounds.center.x) / bounds.width;
  const pitch = (mirroredNose.y - bounds.center.y) / bounds.height;
  const positionBiasX = (bounds.center.x - 0.5) * 0.55;
  const positionBiasY = (bounds.center.y - 0.5) * 0.35;

  return {
    x: clamp(0.5 + yaw * 1.35 + positionBiasX, 0.02, 0.98),
    y: clamp(0.5 + pitch * 1.45 + positionBiasY, 0.08, 0.92),
  };
}

export function smoothFaceAim(previous: Point | null, next: Point): Point {
  return smoothPoint(previous, next, 0.26);
}
