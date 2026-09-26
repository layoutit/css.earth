import { createHash } from 'node:crypto';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PreparedStar, PreparedStarNode, StarsRecipe } from '../../../../preparation/stars/types.js';
import type { PreparedCssPointField, PreparedPointFieldBank, PreparedPointFieldQuantization } from '@cssearth/renderer/stars/types.ts';
import { POINT_FIELD_BANK_ENCODING, POINT_FIELD_BANK_QUANTIZATION, POINT_FIELD_MAGNITUDE_BOUND, POINT_FIELD_MAGNITUDE_DIVISOR,
  decodePointFieldBank, decodeStarMagnitude, pointFieldBankHeader, pointFieldBankLayout } from '@cssearth/renderer/stars/point-field-bank.ts';
import { IMPERCEPTIBLE_LUMINANCE } from '@cssearth/renderer/stars/point-field-projection.ts';

type Photometry = PreparedCssPointField['photometry'];

/** Worst composited per-pixel alpha change that a star magnitude error can cause at runtime.
 * The runtime interpolates luminance and radius linearly between prepared photometry samples,
 * draws the atlas profile at size 2·haloRadii·radius, hides ordinary stars whose luminance is
 * below IMPERCEPTIBLE_LUMINANCE and clamps coverage anchors to the floor and minimum radius.
 * Atlas alpha is min(1, core + halo): core = 1 - smoothstep(inner, outer, u), halo =
 * haloPeak·(1 - smoothstep(0, 1, u)), u = pixel distance / half the drawn size. A pixel at a
 * fixed distance sees du = -u·Δsize/size, and the steepest core edge lies at u <= outer. */
export function magnitudeDisplayAlphaChange(photometry: Photometry, atlas: StarsRecipe['atlas'], errorMagnitudes: number): number {
  const inner = atlas.coreInnerRadii / atlas.haloRadii, outer = atlas.coreOuterRadii / atlas.haloRadii;
  const profileGain = (1.5 / (outer - inner) + 1.5 * atlas.haloPeak) * outer, perStep = errorMagnitudes / photometry.step;
  let worst = 0;
  for (const anchor of [false, true]) for (let index = 0; index + 1 < photometry.samples.length; index++) {
    const clamp = ({ radiusPx, luminance }: { radiusPx: number; luminance: number }) => anchor
      ? { radius: Math.max(photometry.minimumRadiusPx, radiusPx), luminance: Math.max(photometry.floor, luminance) }
      : { radius: radiusPx, luminance };
    const a = clamp(photometry.samples[index]!), b = clamp(photometry.samples[index + 1]!);
    const luminance = Math.max(a.luminance, b.luminance);
    // Never drawn anywhere on this segment. A star crossing the threshold changes a pixel by at most
    // the threshold itself, which the runtime already defines as imperceptible.
    if (!anchor && luminance < IMPERCEPTIBLE_LUMINANCE) continue;
    const radius = Math.min(a.radius, b.radius);
    const change = Math.abs(b.luminance - a.luminance) * perStep +
      (b.radius === a.radius ? 0 : luminance * profileGain * Math.abs(b.radius - a.radius) * perStep / radius);
    if (!(change >= 0)) return Infinity;
    worst = Math.max(worst, change);
  }
  return worst;
}

/** Encodes prepared rows into the column bank, then decodes it with the runtime decoder and
 * asserts every field against its declared bound. Any drift fails preparation. */
export function encodePointFieldBank(input: {
  readonly path: string; readonly idPrefix: string; readonly frame: DensityVolumeFrame; readonly colorCount: number;
  readonly stars: readonly PreparedStar[]; readonly nodes: readonly PreparedStarNode[];
  readonly photometry: Photometry; readonly atlas: StarsRecipe['atlas'];
}): { readonly bytes: Buffer; readonly bank: PreparedPointFieldBank } {
  const { stars, nodes, idPrefix } = input;
  const idPattern = new RegExp(`^${idPrefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}:(0|[1-9][0-9]*)$`, 'u');
  const rows = stars.map(star => {
    const match = idPattern.exec(star.id);
    if (!match) throw new TypeError(`Star ${star.id} is not a ${idPrefix} source row.`);
    return Number(match[1]);
  });
  const anchors = stars.flatMap((star, index) => star.coverageAnchor ? [index] : []);
  const names = stars.flatMap((star, index) => star.name === null ? [] : [Object.freeze([index, star.name] as const)]);
  if (names.some(([, name]) => !name)) throw new TypeError('Star names must be nonempty or null.');
  const childLinkCount = nodes.reduce((sum, node) => sum + node.children.length, 0);
  if (nodes.some(node => node.children.length > 0xff)) throw new TypeError('A hierarchy node exceeds the 255-child bank limit.');
  const counts = { starCount: stars.length, nodeCount: nodes.length, childLinkCount, anchorCount: anchors.length };
  const layout = pointFieldBankLayout(counts), buffer = new ArrayBuffer(layout.bytes);
  new Uint8Array(buffer).set(pointFieldBankHeader(counts));
  const column = <T>(name: string, make: new (buffer: ArrayBuffer, offset: number, length: number) => T): T => {
    const entry = layout.columns.find(candidate => candidate.name === name);
    if (!entry) throw new TypeError(`Missing bank column ${name}.`);
    return new make(buffer, entry.offset, entry.count);
  };
  const sourceRows = column('star.sourceRow', Uint32Array), positions = column('star.positionUnits', Float32Array);
  const magnitudes = column('star.absoluteMagnitude', Int16Array), colors = column('star.colorIndex', Uint8Array);
  let magnitudeError = 0;
  stars.forEach((star, index) => {
    sourceRows[index] = rows[index]!;
    star.positionUnits.forEach((value, axis) => {
      if (Math.fround(value) !== value) throw new TypeError(`Star ${star.id} position is not its float32 source value.`);
      positions[index * 3 + axis] = value;
    });
    const quantized = Math.round(star.absoluteMagnitude * POINT_FIELD_MAGNITUDE_DIVISOR);
    if (!Number.isFinite(star.absoluteMagnitude) || quantized < -0x8000 || quantized > 0x7fff) throw new TypeError(`Star ${star.id} magnitude exceeds int16 millimagnitudes.`);
    magnitudes[index] = quantized;
    magnitudeError = Math.max(magnitudeError, Math.abs(decodeStarMagnitude(quantized) - star.absoluteMagnitude));
    if (!Number.isInteger(star.colorIndex) || star.colorIndex < 0 || star.colorIndex > 0xff) throw new TypeError(`Star ${star.id} color index exceeds uint8.`);
    colors[index] = star.colorIndex;
  });
  column('star.coverageAnchor', Uint32Array).set(anchors);
  const nodePositions = column('node.positionUnits', Float64Array), radii = column('node.radiusUnits', Float64Array);
  const nodeMagnitudes = column('node.absoluteMagnitude', Float64Array), nodeColors = column('node.colorIndex', Uint8Array);
  const firsts = column('node.first', Uint32Array), nodeCounts = column('node.count', Uint32Array);
  const childCounts = column('node.childCount', Uint8Array), links = column('node.children', Uint32Array);
  let link = 0;
  nodes.forEach((node, index) => {
    nodePositions.set(node.positionUnits, index * 3);
    radii[index] = node.radiusUnits; nodeMagnitudes[index] = node.absoluteMagnitude; nodeColors[index] = node.colorIndex;
    firsts[index] = node.first; nodeCounts[index] = node.count; childCounts[index] = node.children.length;
    links.set(node.children, link); link += node.children.length;
  });

  if (magnitudeError > POINT_FIELD_MAGNITUDE_BOUND) throw new RangeError(`Star magnitude quantization error ${magnitudeError} exceeds ${POINT_FIELD_MAGNITUDE_BOUND} mag.`);
  const alphaChange = magnitudeDisplayAlphaChange(input.photometry, input.atlas, POINT_FIELD_MAGNITUDE_BOUND);
  if (!(alphaChange < IMPERCEPTIBLE_LUMINANCE)) {
    throw new RangeError(`A ${POINT_FIELD_MAGNITUDE_BOUND} mag error can change a pixel by ${alphaChange}, above the ${IMPERCEPTIBLE_LUMINANCE} display threshold.`);
  }
  const quantization: PreparedPointFieldQuantization[] = POINT_FIELD_BANK_QUANTIZATION.map(entry => Object.freeze({ ...entry,
    measured: entry.field === 'star.absoluteMagnitude' ? magnitudeError : 0,
    displayAlphaChange: entry.field === 'star.absoluteMagnitude' ? alphaChange : 0 }));
  const bytes = Buffer.from(buffer);
  const bank: PreparedPointFieldBank = Object.freeze({ encoding: POINT_FIELD_BANK_ENCODING, path: input.path, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), starIdPrefix: idPrefix, ...counts,
    columns: layout.columns, names: Object.freeze(names), quantization: Object.freeze(quantization) });

  // Decode what will ship and compare it with the prepared rows.
  const decoded = decodePointFieldBank(bytes, bank, { frame: input.frame, colorCount: input.colorCount });
  let measured = 0;
  decoded.stars.forEach((star, index) => {
    const expected = stars[index]!;
    measured = Math.max(measured, Math.abs(star.absoluteMagnitude - expected.absoluteMagnitude));
    if (star.id !== expected.id || star.positionUnits.some((value, axis) => value !== expected.positionUnits[axis]) ||
        !(Math.abs(star.absoluteMagnitude - expected.absoluteMagnitude) <= POINT_FIELD_MAGNITUDE_BOUND) ||
        star.colorIndex !== expected.colorIndex || star.name !== expected.name || star.coverageAnchor !== expected.coverageAnchor) {
      throw new RangeError(`Decoded bank star ${index} exceeds its declared bounds.`);
    }
  });
  if (measured !== magnitudeError) throw new RangeError('Decoded star magnitude error differs from the recorded measurement.');
  decoded.nodes.forEach((node, index) => {
    const expected = nodes[index]!;
    if (node.positionUnits.some((value, axis) => value !== expected.positionUnits[axis]) || node.radiusUnits !== expected.radiusUnits ||
        node.absoluteMagnitude !== expected.absoluteMagnitude || node.colorIndex !== expected.colorIndex || node.first !== expected.first ||
        node.count !== expected.count || node.children.length !== expected.children.length || node.children.some((child, order) => child !== expected.children[order])) {
      throw new RangeError(`Decoded bank node ${index} is not lossless.`);
    }
  });
  return Object.freeze({ bytes, bank });
}
