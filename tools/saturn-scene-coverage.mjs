import assert from "node:assert/strict";

// Independent sentinels selected from the visually inspected, source-bound
// ba1efaf base captures on 2026-09-04, Chrome 152.0.7977.76. Fixed CSS-pixel
// rectangles inside the body and separate ring arcs; never learned from a
// candidate. Minimum RGB > 60 separates these regions from the dark sky.
// Calibration: all sampled base fractions were >= .9559 except north-west
// (>= .678); conservative floors .90/.60 allow edge noise, not missing tiles.
export const SATURN_COVERAGE_PROTOCOL = "saturn-default-coverage@1";
const probes = {
  390: [["body", 175, 430, 30, 30], ["upper-ring", 280, 385, 20, 10], ["right-ring", 315, 415, 12, 20], ["left-ring", 55, 470, 10, 20], ["lower-ring", 150, 508, 30, 7]],
  820: [["body", 390, 410, 40, 40], ["upper-ring", 560, 326, 30, 15], ["right-ring", 651, 387, 20, 35], ["left-ring", 145, 485, 20, 35], ["lower-ring", 330, 564, 35, 15]],
  1440: [["body", 850, 400, 60, 60], ["north-west-ring", 550, 325, 50, 30, .60], ["upper-ring", 1180, 220, 50, 30], ["right-ring", 1320, 340, 35, 45], ["left-ring", 415, 490, 30, 45], ["lower-ring", 800, 650, 50, 20]],
};

export function saturnSceneCoverage(width, scale) {
  assert.ok(probes[width] && [1, 2].includes(scale), "Unsupported Saturn coverage viewport");
  return {
    // The accepted responsive stage overscans the 900px viewport by 1 CSS px
    // below the desktop breakpoint; pin that existing capture geometry too.
    width: width * scale, height: (width < 961 ? 901 : 900) * scale,
    regions: probes[width].map(([name, x, y, w, h, minimumFraction = .90]) => ({
      name, x: x * scale, y: y * scale, width: w * scale, height: h * scale, minimumFraction,
    })),
  };
}
