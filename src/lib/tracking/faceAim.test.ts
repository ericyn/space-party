import { describe, expect, it } from "vitest";
import { estimateFaceAim, type FaceAimLandmark } from "./faceAim";

function landmarksWithNose(nose: FaceAimLandmark): FaceAimLandmark[] {
  return Array.from({ length: 32 }, (_, index) => {
    if (index === 1) return nose;
    return {
      x: index % 2 === 0 ? 0.3 : 0.7,
      y: index % 3 === 0 ? 0.2 : 0.8,
    };
  });
}

describe("estimateFaceAim", () => {
  it("keeps a neutral face near the center", () => {
    const aim = estimateFaceAim(landmarksWithNose({ x: 0.5, y: 0.5 }));
    expect(aim?.x).toBeCloseTo(0.5, 2);
    expect(aim?.y).toBeCloseTo(0.5, 2);
  });

  it("moves the target horizontally with head direction", () => {
    const aim = estimateFaceAim(landmarksWithNose({ x: 0.42, y: 0.5 }));
    expect(aim?.x).toBeGreaterThan(0.6);
  });
});
