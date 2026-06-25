import type { GameModule } from "../types";

export const GAMES: GameModule[] = [
  {
    id: "bubbles",
    title: "Pop the Bubbles",
    shortTitle: "Bubbles",
    description:
      "Aim with one or both index fingers, then poke forward to burst bubbles.",
    instruction:
      "Point an index finger at a bubble and make a quick tapping motion toward the camera. Use either hand, or both hands at once.",
    tracker: "hand",
    durationLabel: "45 second round",
    accent: "oklch(0.8 0.133 220.221)",
  },
  {
    id: "puzzle",
    title: "Pinch Puzzle",
    shortTitle: "Puzzle",
    description:
      "Pinch, carry, and fit friendly shapes into their matching homes.",
    instruction:
      "Bring your thumb and index finger together to grab. Open them to release.",
    tracker: "hand",
    durationLabel: "4, 6, or 8 pieces",
    accent: "oklch(0.82 0.171 78.466)",
  },
  {
    id: "simon",
    title: "Simon Says",
    shortTitle: "Simon Says",
    description: "Follow hand and face prompts—but only when Simon says.",
    instruction:
      "Wait for a prompt, then hold the matching gesture until the ring fills.",
    tracker: "hand",
    durationLabel: "12 quick prompts",
    accent: "oklch(0.547 0.095 188.18)",
  },
  {
    id: "fruit",
    title: "Fruit Slicer",
    shortTitle: "Fruit",
    description:
      "Swipe your fingertip through flying fruit—but dodge the bombs.",
    instruction:
      "Move your hand quickly through the fruit to slice it. Avoid the dark bombs.",
    tracker: "hand",
    durationLabel: "60 second round",
    accent: "oklch(0.646 0.241 32.489)",
  },
  {
    id: "flap",
    title: "Mouth Flap",
    shortTitle: "Flap",
    description: "Open your mouth to fly up and glide through the gaps.",
    instruction:
      "Open your mouth to flap upward and close it to drift down. Fly through the gates.",
    tracker: "face",
    durationLabel: "Survive the gates",
    accent: "oklch(0.636 0.2 253.539)",
  },
  {
    id: "draw",
    title: "Air Drawing",
    shortTitle: "Draw",
    description: "Pinch your fingers to paint in the air with shifting colors.",
    instruction:
      "Pinch your thumb and index finger to draw. Open your hand to lift the pen. Hover or tap a color card to change color.",
    tracker: "hand",
    durationLabel: "Free draw canvas",
    accent: "oklch(0.8 0.133 220.221)",
  },
  {
    id: "sixseven",
    title: "Doing the 6 7",
    shortTitle: "6 7",
    description:
      "Move both arms in opposite directions: one up, one down, then swap as fast as you can.",
    instruction:
      "Show both arms. Keep one arm up and the other down, then alternate up and down. Each clean 6 or 7 pose scores a point.",
    tracker: "hand",
    durationLabel: "20 second sprint",
    accent: "oklch(0.407 0.126 253.267)",
  },
];

export function getGame(id: GameModule["id"]): GameModule {
  const game = GAMES.find((candidate) => candidate.id === id);
  if (!game) throw new Error(`Unknown game: ${id}`);
  return game;
}
