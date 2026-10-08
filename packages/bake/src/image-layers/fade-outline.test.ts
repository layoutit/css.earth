import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawingBoundary, FRAME_JOIN_ARCSEC, frameReach, outlineFade, type FadeOutline } from './fade-outline.ts';
import { ringOutlineRadius } from './shape.ts';

// A frame like Cassiopeia A's Webb picture: a rectangle about 365 by 420 arcsec turned 27 degrees, the star 30 arcsec
// off its centre, the shell's rim close to the frame on one side, and knots reaching toward the frame's far corner over 50 degrees.
const turn = 27 * Math.PI / 180, centre = [-30, 5] as const;
const frame = ([[-182, 210], [182, 210], [182, -210], [-182, -210]] as const).map(([x, y]) =>
  [centre[0] + x * Math.cos(turn) + y * Math.sin(turn), centre[1] - x * Math.sin(turn) + y * Math.cos(turn)] as const);
const rim = ringOutlineRadius({ source: 'test', basis: 'test', positionAnglesDeg: [12, 52, 108, 154, 192, 234, 341], radiiArcsec: [159, 168, 162, 150, 157, 161, 157], scale: 1.06 });
const jet = (east: number, north: number) => { const pa = Math.atan2(east, north) * 180 / Math.PI; return Math.abs(pa + 110) < 25 ? 310 : 120; };
const fade: FadeOutline = { outward: 1.25, featherArcsec: 35, frameMarginArcsec: 12, smoothDeg: 10 };
const toward = (deg: number) => [Math.sin(deg * Math.PI / 180), Math.cos(deg * Math.PI / 180)] as const;

/** The most a radius's slope, in arcsec per radian, changes between neighbouring directions half a degree apart: a corner
 * is a step in the slope, so it shows however finely the directions are sampled. */
function sharpest(radius: (east: number, north: number) => number): number {
  const h = 0.5, slope = (deg: number) => (radius(...toward(deg + h / 2)) - radius(...toward(deg - h / 2))) / (h * Math.PI / 180);
  let most = 0; for (let deg = 0; deg < 360; deg += h / 4) most = Math.max(most, Math.abs(slope(deg + h / 2) - slope(deg - h / 2)));
  return most;
}
const CORNER = 60;

test('a picture faded on its outline stops at a rounded boundary inside its frame', () => {
  const boundary = drawingBoundary({ rim, reach: jet, frame, fade }), inside = frameReach(frame, fade.frameMarginArcsec);
  for (let deg = 0; deg < 360; deg += 0.1) {
    const [east, north] = toward(deg), r = boundary(east, north);
    assert.ok(r <= inside(east, north) + 1e-9, `at ${deg.toFixed(1)}° the boundary (${r.toFixed(1)}″) is past the frame less its margin (${inside(east, north).toFixed(1)}″)`);
    assert.ok(r >= rim(east, north) * 0.75, `at ${deg.toFixed(1)}° the boundary (${r.toFixed(1)}″) falls far inside the rim`);
  }
  // No corner: the boundary's slope changes gently everywhere. The frame less its margin has four, and the same measure finds them.
  const smooth = sharpest(boundary), corners = sharpest(inside);
  assert.ok(smooth < CORNER, `the boundary's slope steps by ${smooth.toFixed(0)}″ per radian`);
  assert.ok(corners > 5 * CORNER, `the frame's corners step its slope by ${corners.toFixed(0)}″ per radian`);
  // Toward the jet the boundary reaches past the rim pushed out, as far as the frame lets it.
  assert.ok(boundary(...toward(250)) > rim(...toward(250)) * fade.outward);
});

test('the fade is whole inside its feather and nothing past the boundary', () => {
  assert.equal(outlineFade(100, 200, 35), 1);
  assert.equal(outlineFade(200, 200, 35), 0);
  assert.equal(outlineFade(250, 200, 35), 0);
  assert.equal(outlineFade(182.5, 200, 35), 0.5);
});

test('where the shell reaches past the frame, the boundary follows the frame less its margin: its sides straight, its corners cut by a feather-wide arc', () => {
  // A shell far wider than the frame, so the frame alone sets the boundary.
  const wide = () => 400, boundary = drawingBoundary({ rim: wide, reach: null, frame, fade }), inside = frameReach(frame, fade.frameMarginArcsec);
  // The near side's foot: the direction straight at the frame's closest side. An angular window would pull the far
  // directions on either side into it, and bend the side into an arc about the star.
  let foot = 0; for (let deg = 0; deg < 360; deg += 0.1) if (inside(...toward(deg)) < inside(...toward(foot))) foot = deg;
  for (const off of [-20, 0, 20]) { const [east, north] = toward(foot + off);
    assert.ok(boundary(east, north) > inside(east, north) - 1, `${off}° from the near side's foot the boundary (${boundary(east, north).toFixed(1)}″) falls short of the frame less its margin (${inside(east, north).toFixed(1)}″)`); }
  // Each corner of the frame less its margin is cut by an arc of the feather's radius: on its bisector, the arc lies
  // (√2 − 1) times the radius inside the corner for a right angle, and the soft join adds at most FRAME_JOIN_ARCSEC ln 2.
  const cut = (Math.SQRT2 - 1) * fade.featherArcsec + FRAME_JOIN_ARCSEC * Math.LN2 + 1;
  for (let deg = 0; deg < 360; deg += 0.1) {
    const here = inside(...toward(deg)), before = inside(...toward(deg - 0.1)), after = inside(...toward(deg + 0.1));
    if (here > before && here > after) assert.ok(boundary(...toward(deg)) > here - cut, `at the corner at ${deg.toFixed(1)}° the boundary (${boundary(...toward(deg)).toFixed(1)}″) is more than ${cut.toFixed(1)}″ inside it (${here.toFixed(1)}″)`);
  }
});
