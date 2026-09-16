/** Server/offline graph preparation from the existing registered ridge fields. */
import { createHash } from 'node:crypto';
import type { CombinedEvidence, EvidenceInputs } from './model.ts';
import { defaultRidgeGraphSettings, readRidgeGraphSettings, type RidgeGraph, type RidgeNode, type RidgePoint, type RidgePolyline } from './ridge-model.ts';
import { ridgeNeighbors, ridgeSkeleton } from './ridge-skeleton.ts';

function validateFields(inputs: EvidenceInputs, combined: CombinedEvidence): void {
  const length = inputs.grid.width * inputs.grid.height, count = inputs.sources.length;
  if (!Number.isInteger(inputs.grid.width) || !Number.isInteger(inputs.grid.height) || length < 1 || length > 2_000_000 || count < 1 || count > 8 ||
      combined.width !== inputs.grid.width || combined.height !== inputs.grid.height || combined.settings.channel !== 'ridges' ||
      !Number.isFinite(inputs.grid.arcsecondsPerPixel) || inputs.grid.arcsecondsPerPixel <= 0 ||
      combined.planes.length !== count || combined.coverage.length !== count) throw new TypeError('Ridge graph requires a matching bounded ridge-only combination.');
  for (const plane of [combined.union, combined.agreement, ...combined.planes])
    if (plane.length !== length || plane.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new TypeError('Invalid normalized ridge response.');
  for (let s = 0; s < count; s++) {
    const source = inputs.sources[s];
    for (const plane of [source.ridgeDirectionX, source.ridgeDirectionY])
      if (plane.length !== length || plane.some(v => !Number.isFinite(v))) throw new TypeError('Invalid projected ridge tangents.');
    for (const mask of [source.footprint, source.channels.ridges.coverage, combined.coverage[s]])
      if (mask.length !== length || mask.some(v => v !== 0 && v !== 1)) throw new TypeError('Invalid ridge footprint or scale coverage.');
  }
}
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
const distance = (a: number, b: number, width: number) => Math.hypot(a % width - b % width, Math.floor(a / width) - Math.floor(b / width));

export function buildRidgeGraph(inputs: EvidenceInputs, combined: CombinedEvidence, requested: unknown = defaultRidgeGraphSettings): RidgeGraph {
  validateFields(inputs, combined);
  const settings = readRidgeGraphSettings(requested), { width, height } = inputs.grid, supported = new Uint8Array(width * height);
  const eligible = (s: number, p: number) => inputs.sources[s].footprint[p] && inputs.sources[s].channels.ridges.coverage[p] && combined.coverage[s][p];
  for (let p = 0; p < supported.length; p++) if (combined.union[p] >= settings.threshold && inputs.sources.some((_source, s) => eligible(s, p) && combined.planes[s][p] >= settings.threshold)) supported[p] = 1;
  const { mask, passes } = ridgeSkeleton(supported, width, height), neighbors = new Map<number, number[]>();
  for (let p = 0; p < mask.length; p++) if (mask[p]) neighbors.set(p, ridgeNeighbors(p, mask, width, height));
  const componentOf = new Map<number, string>(), components: number[][] = [];
  let discardedComponents = 0;
  for (const start of neighbors.keys()) {
    if (componentOf.has(start)) continue;
    const pixels = [start], provisional = `candidate-${start}`; componentOf.set(start, provisional); let lengthPixels = 0;
    for (let head = 0; head < pixels.length; head++) for (const next of neighbors.get(pixels[head]) ?? []) {
      lengthPixels += distance(pixels[head], next, width) / 2;
      if (!componentOf.has(next)) { componentOf.set(next, provisional); pixels.push(next); }
    }
    if (lengthPixels * inputs.grid.arcsecondsPerPixel < settings.minLengthArcseconds || lengthPixels === 0) { discardedComponents++; continue; }
    const id = `component-${components.length}`; pixels.sort((a, b) => a - b); for (const p of pixels) componentOf.set(p, id); components.push(pixels);
  }
  const point = (p: number): RidgePoint => {
    let observedMask = 0, coverageMask = 0, supportMask = 0;
    const sourceValues: (number | null)[] = [], sourceTangents: ([number, number] | null)[] = [];
    for (let s = 0; s < inputs.sources.length; s++) {
      const source = inputs.sources[s]; if (source.footprint[p]) observedMask |= 1 << s;
      const value = eligible(s, p) ? combined.planes[s][p] : null;
      sourceValues.push(value);
      if (value !== null) { coverageMask |= 1 << s; if (value >= settings.threshold) supportMask |= 1 << s; }
      const tx = source.ridgeDirectionX[p], ty = source.ridgeDirectionY[p], norm = Math.hypot(tx, ty);
      sourceTangents.push(value !== null && value > 0 && norm > 1e-6 ? [tx / norm, ty / norm] : null);
    }
    return { x: p % width + .5, y: Math.floor(p / width) + .5, score: combined.union[p], agreement: combined.agreement[p], observedMask, coverageMask, supportMask, sourceValues, sourceTangents };
  };
  const nodes: RidgeNode[] = [], nodeAt = new Map<number, number>(), nodePixels: number[][] = [];
  const addNode = (pixels: number[], kind: RidgeNode['kind']) => {
    pixels.sort((a, b) => a - b); const index = nodes.length;
    // The first actual support pixel is a stable anchor; no unsupported mean position is invented.
    nodes.push({ ...point(pixels[0]), id: `node-${index}`, kind, supportPixels: pixels.map(p => [p % width + .5, Math.floor(p / width) + .5]) });
    nodePixels.push(pixels); for (const p of pixels) nodeAt.set(p, index);
  };
  for (const pixels of components) {
    for (const p of pixels) {
      const degree = neighbors.get(p)!.length;
      if (degree === 1) addNode([p], 'endpoint');
      else if (degree > 2 && !nodeAt.has(p)) {
        const junction = [p], seen = new Set(junction);
        for (let head = 0; head < junction.length; head++) for (const next of neighbors.get(junction[head])!)
          if (neighbors.get(next)!.length > 2 && !seen.has(next)) { seen.add(next); junction.push(next); }
        addNode(junction, 'junction');
      }
    }
    if (!pixels.some(p => nodeAt.has(p))) addNode([pixels[0]], 'loop');
  }
  // Paths inside a multi-pixel junction follow observed skeleton edges, never a straight shortcut.
  const junctionPath = (node: number, port: number): number[] => {
    const anchor = nodePixels[node][0]; if (anchor === port) return [anchor];
    const queue = [anchor], previous = new Map<number, number>(); previous.set(anchor, anchor);
    for (let head = 0; head < queue.length && !previous.has(port); head++) for (const next of neighbors.get(queue[head])!)
      if (nodeAt.get(next) === node && !previous.has(next)) { previous.set(next, queue[head]); queue.push(next); }
    if (!previous.has(port)) throw new Error('Disconnected projected junction.');
    const path = [port]; while (path[path.length - 1] !== anchor) path.push(previous.get(path[path.length - 1])!); return path.reverse();
  };
  const used = new Set<string>(), polylines: RidgePolyline[] = [];
  for (let node = 0; node < nodes.length; node++) for (const port of nodePixels[node]) for (const next of neighbors.get(port)!) {
    if (nodeAt.get(next) === node || used.has(edgeKey(port, next))) continue;
    const pixels = junctionPath(node, port); let previous = port, current = next; used.add(edgeKey(port, next));
    while (true) {
      pixels.push(current); const end = nodeAt.get(current);
      if (end !== undefined) {
        const tail = junctionPath(end, current).reverse(); pixels.push(...tail.slice(1)); break;
      }
      const following = neighbors.get(current)!.find(p => p !== previous);
      if (following === undefined || used.has(edgeKey(current, following))) throw new Error('Ridge trace ended without a graph node.');
      used.add(edgeKey(current, following)); previous = current; current = following;
    }
    const end = nodeAt.get(current)!; const points = pixels.map(point);
    const lengthPixels = pixels.reduce((sum, p, i) => i ? sum + distance(pixels[i - 1], p, width) : 0, 0);
    const sourceSupport = inputs.sources.map((source, s) => {
      const values = points.map(p => p.sourceValues[s]).filter((v): v is number => v !== null);
      return { sourceId: source.id, coveredFraction: values.length / points.length, supportedFraction: values.filter(v => v >= settings.threshold).length / points.length,
        meanScore: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
    });
    polylines.push({ id: `ridge-${polylines.length}`, componentId: componentOf.get(port)!, from: nodes[node].id, to: nodes[end].id, closed: node === end,
      points, lengthPixels, lengthArcseconds: lengthPixels * inputs.grid.arcsecondsPerPixel,
      meanScore: points.reduce((sum, p) => sum + p.score, 0) / points.length, peakScore: points.reduce((peak, p) => Math.max(peak, p.score), 0), sourceSupport });
  }
  const data: Omit<RidgeGraph, 'id'> = { schema: 'cssearth-projected-ridge-graph@1', inputIdentity: inputs.identity, grid: inputs.grid, settings, combination: combined.settings,
    sources: inputs.sources.map(s => ({ id: s.id, label: s.label, sourceSha256: s.sourceSha256, mapSha256: s.mapSha256, sourcePanelSha256: s.sourcePanelSha256 })), nodes, polylines,
    diagnostics: { thresholdPixels: supported.reduce((a, b) => a + b, 0), skeletonPixels: mask.reduce((a, b) => a + b, 0), retainedComponents: components.length, discardedComponents, thinningPasses: passes },
    interpretation: 'Thresholded ridge-support skeleton in the common sky grid. Junctions indicate projected contact only, not physical association or depth. No gaps are bridged; short connected components are filtered without deleting source evidence. Pixel centers are not subpixel ridge fits or measured filament widths.' };
  return { ...data, id: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}
