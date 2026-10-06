import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { rad } from './disc.ts';

type Streams = NonNullable<ImageLayerRecipe['geometry']['streams']>;

/** How many of a stream's published dispersions from its middle its claim reaches: all of a sight line's light inside
 * one dispersion, none beyond this many. A presentation choice: the paper prints the dispersion, not an edge. */
export const STREAM_CLAIM_REACH = 2;

/** A stream's published surface as read from its picture: how much of each cell the stream covers, 0 to 1, the first
 * row the northernmost and the first column the easternmost. */
export interface StreamSurfaceCells { width: number; height: number; cover: Float32Array }

/** How many cells past a published surface's own picture its claim may still reach. */
export const SURFACE_MARGIN_CELLS = 64;

/** Each cell's distance, in cells, from the nearest cell a published surface covers (half or more): 0 on the surface.
 * The grid is the surface's picture with `SURFACE_MARGIN_CELLS` more on every side. */
export function distanceFromSurface(surface: StreamSurfaceCells): { width: number; height: number; cells: Float32Array } {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < surface.width && y < surface.height && surface.cover[y * surface.width + x]! >= .5, edge: [number, number][] = [];
  // Only the surface's own border can be the nearest covered cell to a cell outside it.
  for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) edge.push([x, y]);
  const width = surface.width + 2 * SURFACE_MARGIN_CELLS, height = surface.height + 2 * SURFACE_MARGIN_CELLS, cells = new Float32Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) { const x = i - SURFACE_MARGIN_CELLS, y = j - SURFACE_MARGIN_CELLS; if (on(x, y)) continue; let nearest = Infinity; for (const [ex, ey] of edge) { const d = (ex - x) ** 2 + (ey - y) ** 2; if (d < nearest) nearest = d; } cells[j * width + i] = Math.sqrt(nearest); }
  return { width, height, cells };
}

/** Published gas streams about a centre (`geometry.streams`): each a bundle of Keplerian orbits in one plane through
 * the centre, with the paper's own elements. `semiMajorArcsec`, `eccentricity`, `ascendingNodeDeg`,
 * `argumentOfPerifocusDeg` and `inclinationDeg` are the middle orbit's; the bundle is that orbit with its semi-major
 * axis from 1 - `dispersion` to 1 + `dispersion` times as long, over `trueAnomalyDeg`, the part of the orbit the gas
 * is on. The node is counted from east through north to where the gas crosses the plane of the sky going away, and the
 * inclination is between the sight line going away and the orbit's angular momentum.
 *
 * A sight line meets each stream's plane once. Where that meeting is inside the stream's bundle the sight line's light
 * is on that plane; from the bundle's edge the stream's claim falls to none at `STREAM_CLAIM_REACH` dispersions.
 * A stream with a published `surface` also holds the sight lines inside it (`surfaces`, its cells by the stream's id):
 * the paper mapped the stream there, beyond the bundle, and the plane is still the stream's. Past the surface's edge
 * that claim fades as the bundle's does, over a dispersion of the distance from the centre.
 * Streams that both claim a sight line share it by their claims, more to the one whose middle orbit is nearer. Light
 * no stream claims has no published depth: it lies on the plane of the sky through the centre, the last plane here.
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the centre. */
export function imageLayerStreamsModel(streams: Streams, surfaces: Readonly<Record<string, StreamSurfaceCells>> = {}) {
  const planes = streams.streams.map(stream => {
    const cells = stream.surface ? surfaces[stream.id] : undefined;
    if (stream.surface && !cells) throw new TypeError(`geometry.streams: the cells of ${stream.id}'s surface (${stream.surface.path}) were not read.`);
    const away = stream.surface && cells ? distanceFromSurface(cells) : null;
    /** How far a sight line is outside the stream's published surface, in arcseconds between its cells' middles: 0
     * inside it, and no nearer than `SURFACE_MARGIN_CELLS` cells counts as beyond reach. */
    const outside = (east: number, north: number) => {
      if (!stream.surface || !away) return Infinity;
      const u = stream.surface.centreCell[0] - east / stream.surface.cellArcsec + SURFACE_MARGIN_CELLS, v = stream.surface.centreCell[1] - north / stream.surface.cellArcsec + SURFACE_MARGIN_CELLS, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
      if (i < 0 || j < 0 || i >= away.width - 1 || j >= away.height - 1) return Infinity;
      const at = (x: number, y: number) => away.cells[y * away.width + x]!;
      return (at(i, j) * (1 - a) * (1 - b) + at(i + 1, j) * a * (1 - b) + at(i, j + 1) * (1 - a) * b + at(i + 1, j + 1) * a * b) * stream.surface.cellArcsec;
    };
    const node = rad(stream.ascendingNodeDeg), peri = rad(stream.argumentOfPerifocusDeg), tilt = rad(stream.inclinationDeg), [from, to] = stream.trueAnomalyDeg;
    // Toward the perifocus, and a quarter turn on in the direction of motion; their cross product is the plane's normal.
    const toPerifocus: Vec3 = [Math.cos(node) * Math.cos(peri) - Math.sin(node) * Math.sin(peri) * Math.cos(tilt), Math.sin(node) * Math.cos(peri) + Math.cos(node) * Math.sin(peri) * Math.cos(tilt), Math.sin(peri) * Math.sin(tilt)];
    const onward: Vec3 = [-Math.cos(node) * Math.sin(peri) - Math.sin(node) * Math.cos(peri) * Math.cos(tilt), -Math.sin(node) * Math.sin(peri) + Math.cos(node) * Math.cos(peri) * Math.cos(tilt), Math.cos(peri) * Math.sin(tilt)];
    const normal: Vec3 = [Math.sin(node) * Math.sin(tilt), -Math.cos(node) * Math.sin(tilt), Math.cos(tilt)];
    /** How far along the sight line, from the centre, the stream's plane is met at a sky offset. */
    const depth = (east: number, north: number) => -(east * normal[0] + north * normal[1]) / normal[2];
    const radius = (east: number, north: number) => Math.hypot(east, north, depth(east, north));
    /** Where a sight line meets the plane, against the bundle: `across` in dispersions from the middle orbit, `beyond`
     * in dispersions past the end of the gas along the orbit. */
    const place = (east: number, north: number) => {
      const z = depth(east, north), r = Math.hypot(east, north, z);
      if (!(r > 0)) return { across: 1 / streams.dispersion, beyond: 0 };
      const anomaly = Math.atan2(east * onward[0] + north * onward[1] + z * onward[2], east * toPerifocus[0] + north * toPerifocus[1] + z * toPerifocus[2]);
      const middle = stream.semiMajorArcsec * (1 - stream.eccentricity ** 2) / (1 + stream.eccentricity * Math.cos(anomaly));
      // The anomaly counted on from the start of the gas, a whole turn at most.
      const on = ((anomaly * 180 / Math.PI - from) % 360 + 360) % 360, past = on <= to - from ? 0 : Math.min(on - (to - from), 360 - on);
      return { across: Math.abs(r / middle - 1) / streams.dispersion, beyond: rad(past) / streams.dispersion };
    };
    /** The stream's claim on a sight line, 0 to 1, and its weight against another stream's claim. */
    const claim = (east: number, north: number) => {
      const { across, beyond } = place(east, north), fade = (out: number) => { const t = Math.max(0, Math.min(1, out)); return 1 - t * t * (3 - 2 * t); };
      // The surface's claim fades over the same length as the bundle's does there: a dispersion of the distance from the centre.
      const surface = fade(outside(east, north) / (streams.dispersion * (STREAM_CLAIM_REACH - 1) * Math.max(radius(east, north), 1e-9))), held = Math.max(fade(Math.hypot(Math.max(0, across - 1), beyond) / (STREAM_CLAIM_REACH - 1)), surface);
      // Inside its published surface a sight line counts as on the stream's middle.
      return { held, weight: held / (1 + (across * (1 - surface)) ** 2) };
    };
    return { id: stream.id, normal, depth, radius, place, claim, outside };
  });
  /** Every stream's share of a sight line's light, in the streams' order, then the plane of the sky's. */
  const shares = (east: number, north: number): number[] => {
    const claims = planes.map(plane => plane.claim(east, north)), held = claims.reduce((sum, claim) => sum + claim.held, 0), weights = claims.reduce((sum, claim) => sum + claim.weight, 0);
    if (!(held > 0)) return [...claims.map(() => 0), 1];
    const placed = Math.min(1, held);
    return [...claims.map(claim => placed * claim.weight / weights), 1 - placed];
  };
  const sky: Vec3 = [0, 0, 1];
  return { streams, thickness: 0, shares, planes: [
    ...planes.map((plane, index) => ({ id: plane.id, normal: plane.normal, depth: plane.depth, radius: plane.radius, place: plane.place, outside: plane.outside, share: (east: number, north: number) => shares(east, north)[index]! })),
    { id: 'sky', normal: sky, depth: () => 0, radius: (east: number, north: number) => Math.hypot(east, north), place: () => ({ across: Infinity, beyond: 0 }), outside: () => Infinity, share: (east: number, north: number) => shares(east, north)[planes.length]! },
  ] };
}
