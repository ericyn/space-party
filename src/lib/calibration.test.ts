import { describe, expect, it } from "vitest";
import {
  createHandMovementBounds,
  extendHandMovementBounds,
  faceExpressionDetected,
  handMovementProgress,
} from "./calibration";

describe("camera calibration", () => {
  it("requires meaningful hand travel rather than small tracking jitter", () => {
    let bounds = createHandMovementBounds({ x: 0.5, y: 0.5 });
    bounds = extendHandMovementBounds(bounds, { x: 0.52, y: 0.51 });
    expect(handMovementProgress(bounds)).toBeLessThan(0.2);

    bounds = extendHandMovementBounds(bounds, { x: 0.72, y: 0.5 });
    expect(handMovementProgress(bounds)).toBe(1);
  });

  it("requires a face expression to change from the neutral baseline", () => {
    const neutral = { smile: 0.12, jawOpen: 0.05, browRaise: 0.08 };
    expect(
      faceExpressionDetected(
        { smile: 0.61, jawOpen: 0.05, browRaise: 0.08 },
        neutral,
      ),
    ).toBe(true);
    expect(
      faceExpressionDetected(
        { smile: 0.2, jawOpen: 0.16, browRaise: 0.15 },
        neutral,
      ),
    ).toBe(false);
  });
});
