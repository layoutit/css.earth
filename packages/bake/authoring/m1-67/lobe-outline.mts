/**
 * The outline of the lobes in a published drawing of a model, where the paper prints no formula for it.
 *
 * Zavala et al. (2022) model each pair of lobes of M 1-67 as "a hollow ellipsoidal component squished at the waist" and
 * print its semi-axes and a squish parameter, but not what the squish does to the outline. Their Figure 3 draws each
 * structure in the plane of the sky, lobes and torus in two colors. This reads the lobes' drawn silhouette there: the
 * pixels of the lobes' color, their wire mesh closed into a solid, and the half-width across the symmetry axis at each
 * place along it, with the drawn half-length standing for the printed semi-major axis.
 *
 * Each silhouette is two rounded lobes that overlap at the waist. It is fitted by two ellipsoids of revolution on the
 * axis: their middles `centre` from the star, as a part of the semi-major axis a, and their half-width `width`, as a
 * multiple of the semi-minor axis b; each reaches the outline's end, so its half-length is a less its middle's place.
 * The inner structure's lobes and torus share one color in the figure and cannot be told apart: not read.
 *
 * Usage: node packages/bake/authoring/m1-67/lobe-outline.mts <the figure's PNG>
 * The figure: "Fig_shape1.png" of arXiv:2204.07778 as ar5iv serves it (https://ar5iv.labs.arxiv.org/html/2204.07778), 1167 x 514 px.
 */
import sharp from 'sharp';

const [figure = ''] = process.argv.slice(2);
if (!figure) throw new TypeError('Usage: lobe-outline.mts <the figure\'s PNG>');
const { data, info } = await sharp(figure).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1167 || info.height !== 514) throw new RangeError(`${figure} is ${info.width} x ${info.height} px; the panels below are placed on the 1167 x 514 px figure.`);
type Rgb = readonly [number, number, number];
/** Each structure's panel in the top row (left, top, right, bottom), its lobes' color, and Table 2's semi-axes and squish. */
const PANELS = [
  { name: 'middle', box: [405, 25, 630, 230], lobe: ([r, g, b]: Rgb) => b > 150 && g > 100 && r < 80 && g - r > 60, a: 55, b: 24.2, squish: 0.56 },
  { name: 'outer', box: [645, 20, 865, 235], lobe: ([r, g, b]: Rgb) => r > 150 && g < 105 && b < 105 && r - b > 70, a: 55, b: 35.8, squish: 0.35 },
] as const;
/** The wire mesh is closed by growing and shrinking the colored pixels by this many pixels. */
const CLOSE_PX = 5, BINS = 41;
for (const panel of PANELS) {
  const [x0, y0, x1, y1] = panel.box, w = x1 - x0, h = y1 - y0, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const at = ((y + y0) * info.width + x + x0) * 3; if (panel.lobe([data[at]!, data[at + 1]!, data[at + 2]!])) mask[y * w + x] = 1; }
  const morph = (source: Uint8Array, grow: boolean) => { const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let value = grow ? 0 : 1;
      search: for (let dy = -CLOSE_PX; dy <= CLOSE_PX; dy++) for (let dx = -CLOSE_PX; dx <= CLOSE_PX; dx++) { if (dx * dx + dy * dy > CLOSE_PX * CLOSE_PX) continue;
        const X = x + dx, Y = y + dy, inside = X >= 0 && Y >= 0 && X < w && Y < h ? source[Y * w + X]! : 0; if (grow ? inside : !inside) { value = grow ? 1 : 0; break search; } }
      out[y * w + x] = value; }
    return out; };
  const solid = morph(morph(mask, true), false), points: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid[y * w + x]) points.push([x, y]);
  const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length, cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let sxx = 0, sxy = 0, syy = 0; for (const [x, y] of points) { sxx += (x - cx) ** 2; sxy += (x - cx) * (y - cy); syy += (y - cy) ** 2; }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy), axis = [Math.cos(angle), Math.sin(angle)] as const, across = [-axis[1], axis[0]] as const;
  const along = points.map(([x, y]) => (x - cx) * axis[0] + (y - cy) * axis[1]), wide = points.map(([x, y]) => (x - cx) * across[0] + (y - cy) * across[1]);
  const low = Math.min(...along), high = Math.max(...along), half = (high - low) / 2, middle = (high + low) / 2, arcsecPerPixel = panel.a / half;
  const reach = Array.from({ length: BINS }, () => [Infinity, -Infinity] as [number, number]);
  along.forEach((u, index) => { const bin = Math.min(BINS - 1, Math.max(0, Math.round(((u - middle) / half + 1) / 2 * (BINS - 1)))); reach[bin]![0] = Math.min(reach[bin]![0], wide[index]!); reach[bin]![1] = Math.max(reach[bin]![1], wide[index]!); });
  // The two halves of the drawing agree to a few percent: their mean, from the waist (0) to the end (1), in units of b.
  const profile = Array.from({ length: (BINS + 1) / 2 }, (_, step) => { const a = reach[(BINS - 1) / 2 + step]!, b = reach[(BINS - 1) / 2 - step]!; return { t: step / ((BINS - 1) / 2), width: ((a[1] - a[0]) + (b[1] - b[0])) / 4 * arcsecPerPixel / panel.b }; });
  // Two ellipsoids on the axis: the union's half-width at a place t (of a) from the star.
  const model = (t: number, centre: number, width: number) => { const s = (t - centre) / (1 - centre); return Math.abs(s) < 1 ? width * Math.sqrt(1 - s * s) : 0; };
  let best = { rms: Infinity, centre: 0, width: 0 };
  for (let centre = 0.05; centre <= 0.7; centre += 0.001) for (let width = 0.7; width <= 1.8; width += 0.002) {
    let sum = 0, count = 0; for (const point of profile) { if (point.t > 0.9) continue; sum += (model(point.t, centre, width) - point.width) ** 2; count++; }
    const rms = Math.sqrt(sum / count); if (rms < best.rms) best = { rms, centre, width };
  }
  // The drawing's own direction: a position angle counts from north (up) through east (left).
  const pa = (Math.atan2(-axis[0], -axis[1]) * 180 / Math.PI + 360) % 180;
  console.log(`${panel.name} (a ${panel.a}, b ${panel.b} arcsec, squish ${panel.squish}): ${points.length} px; drawn axis at position angle ${(pa > 90 ? pa - 180 : pa).toFixed(1)} deg; ${arcsecPerPixel.toFixed(3)} arcsec a pixel`);
  console.log(`  half-width in b, from the waist to the end: ${profile.map(point => point.width.toFixed(2)).join(' ')}`);
  console.log(`  two lobes: middles at ${best.centre.toFixed(3)} a (${(best.centre * panel.a).toFixed(1)} arcsec), half-width ${best.width.toFixed(3)} b (${(best.width * panel.b).toFixed(1)} arcsec), half-length ${((1 - best.centre) * panel.a).toFixed(1)} arcsec; waist ${model(0, best.centre, best.width).toFixed(2)} b; rms ${best.rms.toFixed(3)} b`);
  console.log(`  the fit, same places:                      ${profile.map(point => model(point.t, best.centre, best.width).toFixed(2)).join(' ')}`);
}
