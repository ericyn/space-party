import { describe, expect, it } from "vitest";
import { findPointTarget, viewportPointFromAim } from "./targetSelection";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }) as DOMRect;

describe("point target selection", () => {
  it("maps normalized aim to viewport pixels", () => {
    expect(
      viewportPointFromAim({ x: 0.25, y: 0.75 }, { width: 800, height: 600 }),
    ).toEqual({
      x: 200,
      y: 450,
    });
  });

  it("selects the nearest expanded game card", () => {
    expect(
      findPointTarget({ x: 238, y: 110 }, [
        { id: "bubbles", rect: rect(20, 40, 160, 120) },
        { id: "puzzle", rect: rect(220, 40, 160, 120) },
      ]),
    ).toBe("puzzle");
  });

  it("uses expanded card bounds so movement can keep the card armed", () => {
    expect(
      findPointTarget({ x: 12, y: 34 }, [
        { id: "bubbles", rect: rect(80, 40, 160, 120) },
      ]),
    ).toBe("bubbles");
  });
});
