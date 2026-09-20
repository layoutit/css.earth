import { parseDensityVolumeFrame } from '@cssearth/objects';
import { POINT_FIELD_BANK_ENCODING, POINT_FIELD_BANK_QUANTIZATION, decodePointFieldBank, pointFieldBankLayout } from './point-field-bank.js';
import type { PreparedCssPointField, PreparedCssPointFieldManifest, PreparedDirectStarField, PreparedPointFieldBank, PreparedPointFieldNode,
  PreparedPointFieldQuantization, PreparedPointFieldResource, PointFieldRgb } from './types.js';

const IDENTIFIER = /^[a-z][a-z0-9-]*$/u;
const ID_PREFIX = /^[a-z0-9][a-z0-9.-]*$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MAX_LEAF_STARS = 32;

/** Validates the JSON manifest of one prepared point field; its rows arrive in the pinned bank. */
export function parsePreparedCssPointFieldManifest(value: unknown): PreparedCssPointFieldManifest {
  const input = record(value, 'prepared CSS point field');
  allowedKeys(input, ['schema', 'id', 'frame', 'bank', 'atlas', 'photometry', 'policy', 'labels', 'diffuseSky', 'directPoints', 'resources', 'provenance'], 'prepared CSS point field');
  for (const key of ['schema', 'id', 'frame', 'bank', 'atlas', 'photometry', 'policy', 'labels', 'resources', 'provenance']) if (!(key in input)) {
    throw new TypeError(`prepared CSS point field is missing ${key}.`);
  }
  if (input.schema !== 'cssearth-css-point-field-bank@1' || typeof input.id !== 'string' || !IDENTIFIER.test(input.id)) {
    throw new TypeError('Prepared point field identity is invalid.');
  }
  const frame = parseDensityVolumeFrame(input.frame);
  const atlas = parseAtlas(input.atlas);
  const bank = parseBank(input.bank);
  const resources = parseResources(input.resources);
  const atlasResource = resources.find(resource => resource.path === atlas.path);
  if (!atlasResource || atlasResource.width !== atlas.columns * atlas.tileSize || atlasResource.height !== atlas.tileSize) {
    throw new TypeError('Point-field atlas metadata does not match its prepared resource.');
  }
  if (resources.some(resource => resource.path === bank.path)) throw new TypeError('Point-field bank cannot also be an image resource.');
  const diffuseSky = parseDiffuseSky(input.diffuseSky, resources);
  const directPoints = parseDirectPoints(input.directPoints, bank, atlas.colors.length);
  const photometry = parsePhotometry(input.photometry);
  const policy = parsePolicy(input.policy);
  const labels = parseLabels(input.labels);
  return Object.freeze({ schema: 'cssearth-css-point-field-bank@1', id: input.id, frame, bank, atlas,
    photometry, policy, labels, ...(diffuseSky === undefined ? {} : { diffuseSky }), ...(directPoints === undefined ? {} : { directPoints }), resources, provenance: input.provenance });
}

/** Decodes verified bank bytes into the immutable point field that selection and rendering consume. */
export function decodePreparedCssPointField(manifest: PreparedCssPointFieldManifest, bytes: ArrayBuffer | Uint8Array): PreparedCssPointField {
  const { stars, nodes } = decodePointFieldBank(bytes, manifest.bank, { frame: manifest.frame, colorCount: manifest.atlas.colors.length });
  validateHierarchy(nodes, stars.length);
  const { id, frame, atlas, photometry, policy, labels, diffuseSky, directPoints, resources, provenance } = manifest;
  return Object.freeze({ schema: 'cssearth-css-point-field@1', id, frame, stars, nodes, atlas,
    photometry, policy, labels, ...(diffuseSky === undefined ? {} : { diffuseSky }), ...(directPoints === undefined ? {} : { directPoints }), resources, provenance });
}

function parseDirectPoints(value: unknown, bank: PreparedPointFieldBank, colorCount: number): PreparedDirectStarField | undefined {
  if (value === undefined) return undefined;
  const input = record(value, 'direct star field');
  exactKeys(input, ['schema', 'catalogueCount', 'selection', 'points'], 'direct star field');
  const catalogueCount = input.catalogueCount;
  if (input.schema !== 'cssearth-direct-star-field@1' || !safePositive(catalogueCount) || catalogueCount !== bank.starCount ||
      typeof input.selection !== 'string' || !input.selection || !Array.isArray(input.points) || input.points.length === 0 || input.points.length > 4096) {
    throw new TypeError('Prepared direct star field is invalid.');
  }
  const rows = new Set<number>();
  const points = input.points.map((value, index) => {
    const point = record(value, `direct star point ${index}`);
    exactKeys(point, ['sourceRow', 'positionUnits', 'absoluteMagnitude', 'colorIndex', 'coverageAnchor'], 'direct star point');
    if (!safeNonnegative(point.sourceRow) || point.sourceRow >= catalogueCount || rows.has(point.sourceRow) ||
        !Array.isArray(point.positionUnits) || point.positionUnits.length !== 3 || !point.positionUnits.every(finite) ||
        !finite(point.absoluteMagnitude) || !safeNonnegative(point.colorIndex) || point.colorIndex >= colorCount || typeof point.coverageAnchor !== 'boolean') {
      throw new TypeError('Prepared direct star point is invalid.');
    }
    rows.add(point.sourceRow);
    return Object.freeze({ sourceRow:point.sourceRow, positionUnits:Object.freeze([point.positionUnits[0],point.positionUnits[1],point.positionUnits[2]]) as readonly [number,number,number],
      absoluteMagnitude:point.absoluteMagnitude,colorIndex:point.colorIndex,coverageAnchor:point.coverageAnchor });
  });
  return Object.freeze({ schema:'cssearth-direct-star-field@1', catalogueCount, selection:input.selection, points:Object.freeze(points) });
}

function parseBank(value: unknown): PreparedPointFieldBank {
  const input = record(value, 'point-field bank');
  exactKeys(input, ['encoding', 'path', 'bytes', 'sha256', 'starIdPrefix', 'starCount', 'nodeCount', 'childLinkCount', 'anchorCount', 'columns', 'names', 'quantization'], 'point-field bank');
  const { starCount, nodeCount, childLinkCount, anchorCount } = input;
  if (input.encoding !== POINT_FIELD_BANK_ENCODING || !relativePath(input.path) || !safePositive(input.bytes) ||
      typeof input.sha256 !== 'string' || !HASH.test(input.sha256) || typeof input.starIdPrefix !== 'string' || !ID_PREFIX.test(input.starIdPrefix) ||
      !safePositive(starCount) || !safePositive(nodeCount) || !safeNonnegative(childLinkCount) || !safeNonnegative(anchorCount) ||
      !Array.isArray(input.columns) || !Array.isArray(input.names) || !Array.isArray(input.quantization)) throw new TypeError('Prepared point-field bank is invalid.');
  const layout = pointFieldBankLayout({ starCount, nodeCount, childLinkCount, anchorCount });
  if (input.bytes !== layout.bytes || input.columns.length !== layout.columns.length) throw new TypeError('Prepared point-field bank layout is invalid.');
  input.columns.forEach((entry, index) => {
    const column = record(entry, `point-field bank column ${index}`), expected = layout.columns[index]!;
    exactKeys(column, ['name', 'storage', 'count', 'offset', 'bytes'], 'point-field bank column');
    if (column.name !== expected.name || column.storage !== expected.storage || column.count !== expected.count ||
        column.offset !== expected.offset || column.bytes !== expected.bytes) throw new TypeError('Prepared point-field bank layout is invalid.');
  });
  let previousName = -1;
  const names = Object.freeze(input.names.map((entry: unknown) => {
    if (!Array.isArray(entry) || entry.length !== 2 || !safeNonnegative(entry[0]) || entry[0] >= starCount || entry[0] <= previousName ||
        typeof entry[1] !== 'string' || !entry[1]) {
      throw new TypeError('Prepared point-field names must be increasing named star indices.');
    }
    previousName = entry[0];
    return Object.freeze([entry[0], entry[1]] as const);
  }));
  if (input.quantization.length !== POINT_FIELD_BANK_QUANTIZATION.length) throw new TypeError('Prepared point-field quantization is invalid.');
  const quantization = Object.freeze(input.quantization.map((entry: unknown, index): PreparedPointFieldQuantization => {
    const field = record(entry, `point-field quantization ${index}`), expected = POINT_FIELD_BANK_QUANTIZATION[index]!;
    exactKeys(field, ['field', 'storage', 'decode', 'unit', 'bound', 'measured', 'displayAlphaChange'], 'point-field quantization');
    if (field.field !== expected.field || field.storage !== expected.storage || field.decode !== expected.decode || field.unit !== expected.unit ||
        field.bound !== expected.bound || !nonnegative(field.measured) || field.measured > expected.bound || !nonnegative(field.displayAlphaChange)) {
      throw new TypeError('Prepared point-field quantization does not match the bank decoder.');
    }
    return Object.freeze({ ...expected, measured: field.measured, displayAlphaChange: field.displayAlphaChange });
  }));
  return Object.freeze({ encoding: POINT_FIELD_BANK_ENCODING, path: input.path, bytes: input.bytes, sha256: input.sha256, starIdPrefix: input.starIdPrefix,
    starCount, nodeCount, childLinkCount, anchorCount, columns: layout.columns, names, quantization });
}

function validateHierarchy(nodes: readonly PreparedPointFieldNode[], starCount: number): void {
  const root = nodes[0];
  if (!root || root.first !== 0 || root.count !== starCount) throw new TypeError('Point-field hierarchy must cover its full catalogue at the root.');
  const seen = new Set<number>(), pending: number[] = [0];
  while (pending.length) {
    const index = pending.pop()!;
    if (seen.has(index)) throw new TypeError('Point-field hierarchy is not a tree.');
    seen.add(index);
    const node = nodes[index]!;
    if (node.first + node.count > starCount) throw new TypeError('Point-field hierarchy range exceeds its catalogue.');
    if (node.children.length === 0) {
      if (node.count > MAX_LEAF_STARS) throw new TypeError('Point-field leaf exceeds its prepared bound.');
      continue;
    }
    let cursor = node.first;
    for (const childIndex of node.children) {
      const child = nodes[childIndex];
      if (!child || child.first !== cursor || child.count > node.count || child.first + child.count > node.first + node.count) {
        throw new TypeError('Point-field children must partition their parent range.');
      }
      cursor += child.count;
      pending.push(childIndex);
    }
    if (cursor !== node.first + node.count) throw new TypeError('Point-field children do not cover their parent range.');
  }
  if (seen.size !== nodes.length) throw new TypeError('Point-field hierarchy contains unreachable nodes.');
}

function parseAtlas(value: unknown): PreparedCssPointField['atlas'] {
  const input = record(value, 'point-field atlas');
  exactKeys(input, ['path', 'columns', 'tileSize', 'colors', 'haloRadii'], 'point-field atlas');
  if (!relativePath(input.path) || !safePositive(input.columns) || !safePositive(input.tileSize) || !positive(input.haloRadii) || !Array.isArray(input.colors) || input.colors.length === 0) {
    throw new TypeError('Prepared point-field atlas is invalid.');
  }
  const colors = Object.freeze(input.colors.map(color => rgb(color)));
  return Object.freeze({ path: input.path, columns: input.columns, tileSize: input.tileSize, colors, haloRadii: input.haloRadii });
}

function parsePhotometry(value: unknown): PreparedCssPointField['photometry'] {
  const input = record(value, 'point-field photometry');
  exactKeys(input, ['minimumMagnitude', 'maximumMagnitude', 'step', 'floor', 'limitingMagnitude', 'hintsLimitMagnitude', 'minimumRadiusPx', 'samples'], 'point-field photometry');
  if (!finite(input.minimumMagnitude) || !finite(input.maximumMagnitude) || !positive(input.step) || !positive(input.floor) || input.floor > 1 || !finite(input.limitingMagnitude) || !finite(input.hintsLimitMagnitude) || !positive(input.minimumRadiusPx) || !(input.maximumMagnitude > input.minimumMagnitude) || !Array.isArray(input.samples)) {
    throw new TypeError('Prepared point-field photometry is invalid.');
  }
  const expected = (input.maximumMagnitude - input.minimumMagnitude) / input.step;
  if (!Number.isInteger(Math.round(expected)) || Math.abs(expected - Math.round(expected)) > 1e-9 || input.samples.length !== Math.round(expected) + 1) {
    throw new TypeError('Point-field photometry does not cover its declared magnitude range.');
  }
  const samples = Object.freeze(input.samples.map((sample, index) => {
    const entry = record(sample, `point-field photometry sample ${index}`);
    exactKeys(entry, ['radiusPx', 'luminance'], 'point-field photometry sample');
    if (!nonnegative(entry.radiusPx) || !nonnegative(entry.luminance) || entry.luminance > 1) throw new TypeError('Prepared point-field photometry sample is invalid.');
    return Object.freeze({ radiusPx: entry.radiusPx, luminance: entry.luminance });
  }));
  return Object.freeze({ minimumMagnitude: input.minimumMagnitude, maximumMagnitude: input.maximumMagnitude, step: input.step, floor: input.floor, limitingMagnitude: input.limitingMagnitude, hintsLimitMagnitude: input.hintsLimitMagnitude, minimumRadiusPx: input.minimumRadiusPx, samples });
}

function parseLabels(value: unknown): PreparedCssPointField['labels'] {
  const input = record(value, 'point-field labels');
  exactKeys(input, ['activeSlots', 'transitionSlots', 'capHeightPx', 'gapPx', 'maxAlpha', 'fadeMs'], 'point-field labels');
  if (!safePositive(input.activeSlots) || !safePositive(input.transitionSlots) || input.transitionSlots < input.activeSlots || !positive(input.capHeightPx) || !positive(input.gapPx) || !positive(input.maxAlpha) || input.maxAlpha > 1 || !positive(input.fadeMs)) throw new TypeError('Prepared point-field labels are invalid.');
  return Object.freeze({ activeSlots: input.activeSlots, transitionSlots: input.transitionSlots, capHeightPx: input.capHeightPx, gapPx: input.gapPx, maxAlpha: input.maxAlpha, fadeMs: input.fadeMs });
}

function parsePolicy(value: unknown): PreparedCssPointField['policy'] {
  const input = record(value, 'point-field policy');
  exactKeys(input, ['activeSlots', 'transitionSlots', 'maxErrorPx', 'transitionMs'], 'point-field policy');
  if (!safePositive(input.activeSlots) || !safePositive(input.transitionSlots) || input.transitionSlots < input.activeSlots || !nonnegative(input.maxErrorPx) || !nonnegative(input.transitionMs)) {
    throw new TypeError('Prepared point-field policy is invalid.');
  }
  return Object.freeze({ activeSlots: input.activeSlots, transitionSlots: input.transitionSlots, maxErrorPx: input.maxErrorPx, transitionMs: input.transitionMs });
}

function parseResources(value: unknown): readonly PreparedPointFieldResource[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('Prepared point field needs resources.');
  const paths = new Set<string>();
  return Object.freeze(value.map((entry, index) => {
    const input = record(entry, `point-field resource ${index}`);
    exactKeys(input, ['path', 'sha256', 'bytes', 'width', 'height'], 'point-field resource');
    if (!relativePath(input.path) || paths.has(input.path) || typeof input.sha256 !== 'string' || !HASH.test(input.sha256) ||
        !safePositive(input.bytes) || !safePositive(input.width) || !safePositive(input.height)) throw new TypeError('Prepared point-field resource is invalid.');
    paths.add(input.path);
    return Object.freeze({ path: input.path, sha256: input.sha256, bytes: input.bytes, width: input.width, height: input.height });
  }));
}

function parseDiffuseSky(value: unknown, resources: readonly PreparedPointFieldResource[]): PreparedCssPointField['diffuseSky'] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== 6) throw new TypeError('Prepared diffuse sky needs six faces.');
  const ids = new Set<string>(), paths = new Set<string>(resources.map(resource => resource.path));
  return Object.freeze(value.map((entry, index) => {
    const input = record(entry, `diffuse sky face ${index}`);
    exactKeys(input, ['id', 'path'], 'diffuse sky face');
    if (typeof input.id !== 'string' || !IDENTIFIER.test(input.id) || ids.has(input.id) || !relativePath(input.path) || !paths.has(input.path)) {
      throw new TypeError('Prepared diffuse sky face is invalid.');
    }
    ids.add(input.id);
    return Object.freeze({ id: input.id, path: input.path });
  }));
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(`${label} has unsupported or missing fields.`);
}
function allowedKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new TypeError(`${label} has unsupported fields.`);
}
function rgb(value: unknown): PointFieldRgb {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => !Number.isInteger(component) || component < 0 || component > 255)) throw new TypeError('Point-field atlas color is invalid.');
  return Object.freeze([value[0], value[1], value[2]]);
}
function relativePath(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..') && !/[\\\u0000-\u0020]/u.test(value); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function positive(value: unknown): value is number { return finite(value) && value > 0; }
function nonnegative(value: unknown): value is number { return finite(value) && value >= 0; }
function safePositive(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function safeNonnegative(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
