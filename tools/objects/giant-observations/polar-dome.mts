import type {ObservedRgb} from './polar-continuation.mts';
import type {domeRingWarp} from '../giant-layers/geometry.mts';

/** Two square pole tiles side by side, RGBA: the south tile first, then the north tile, as both atlas generators write them. */
export interface PolarAtlas {data: Uint8Array; width: number; height: number}
/** A pole tile's own projection: tile coordinates d in [-1, 1]² (y down) lie at radius r = |d| / scale, latitude
 * 90° − r·(90° − edge), and hold the map column (atan2(dx, −dy) + π) / 2π (polar-continuation.mts, observed-coverage.mts). */
export interface PoleProjection {edgeLatitudeDegrees: number; scale: number}
export type DomeRingWarp = ReturnType<typeof domeRingWarp>;

function requireAtlas(atlas: PolarAtlas) {
  const tile = atlas.height;
  if (!Number.isSafeInteger(tile) || tile < 2 || atlas.width !== tile * 2 || atlas.data.length !== atlas.width * atlas.height * 4)
    throw new TypeError(`A polar atlas is two square RGBA tiles, not ${atlas.width} × ${atlas.height} with ${atlas.data.length} bytes.`);
  return tile;
}

/**
 * The pole imagery laid over the map where it reaches, through the tile's own projection: each map texel poleward of the edge
 * takes the tile's colour over its own by the tile's alpha, the composite the flat overlay plate showed over the bands, now
 * registered to the map's longitudes. A dome ring carries the result, so one leaf family covers the polar latitudes.
 */
export function compositePolarOverlay(map: ObservedRgb, atlas: PolarAtlas, {edgeLatitudeDegrees, scale}: PoleProjection): ObservedRgb {
  const tile = requireAtlas(atlas), {width, height, channels} = map.info;
  if (!(edgeLatitudeDegrees > 0 && edgeLatitudeDegrees < 90) || !(scale > 0)) throw new TypeError(`Invalid pole projection: edge ${edgeLatitudeDegrees}, scale ${scale}.`);
  const output = Buffer.from(map.data);
  const texel = (poleTile: number, x: number, y: number) => {
    if (x < 0 || y < 0 || x >= tile || y >= tile) return [0, 0, 0, 0];
    const offset = (y * atlas.width + poleTile * tile + x) * 4, alpha = atlas.data[offset + 3]! / 255;
    return [atlas.data[offset]! * alpha, atlas.data[offset + 1]! * alpha, atlas.data[offset + 2]! * alpha, alpha];
  };
  for (let y = 0; y < height; y++) {
    const latitude = 90 - (y + 0.5) / height * 180, radius = (90 - Math.abs(latitude)) / (90 - edgeLatitudeDegrees);
    if (radius >= 1) continue;
    const poleTile = latitude > 0 ? 1 : 0;
    for (let x = 0; x < width; x++) {
      const longitude = (x + 0.5) / width * Math.PI * 2 - Math.PI, d = radius * scale;
      const px = (Math.sin(longitude) * d + 1) / 2 * tile - 0.5, py = (-Math.cos(longitude) * d + 1) / 2 * tile - 0.5;
      const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
      const samples = [texel(poleTile, x0, y0), texel(poleTile, x0 + 1, y0), texel(poleTile, x0, y0 + 1), texel(poleTile, x0 + 1, y0 + 1)];
      const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const premultiplied = [0, 1, 2, 3].map(channel => samples.reduce((sum, sample, index) => sum + sample[channel]! * weights[index]!, 0));
      const alpha = premultiplied[3]!, offset = (y * width + x) * channels;
      for (let channel = 0; channel < 3; channel++)
        output[offset + channel] = Math.max(0, Math.min(255, Math.round(premultiplied[channel]! + map.data[offset + channel]! * (1 - alpha))));
    }
  }
  return {data: output, info: map.info};
}

/**
 * The atlas laid out for the flat cap that shows it. A cap plate draws its tile with the tile's x along the plate's x and its
 * y along +y at the north pole and −y at the south pole (the plate's own winding), so a tile pixel at d must hold the surface
 * at direction (dx, ±dy): the north tile turns a quarter, the south tile is transposed. Every pixel moves whole; none is resampled.
 */
export function layoutPolarAtlasForCaps(atlas: PolarAtlas) {
  const tile = requireAtlas(atlas), output = Buffer.alloc(atlas.data.length);
  for (let poleTile = 0; poleTile < 2; poleTile++) for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const [sourceX, sourceY] = poleTile === 1 ? [tile - 1 - y, x] : [y, x];
    const from = (sourceY * atlas.width + poleTile * tile + sourceX) * 4, to = (y * atlas.width + poleTile * tile + x) * 4;
    for (let channel = 0; channel < 4; channel++) output[to + channel] = atlas.data[from + channel]!;
  }
  return output;
}

/** A packed band atlas, as packProjectiveSurfaceRaster returns it. */
export interface PackedBands {data: Uint8Array; packedWidth: number; packedHeight: number; gutter: number; bands: readonly {y: number; height: number; packedY: number}[]}

/**
 * Rewrites each dome ring's packed rows, gutters included, with the latitudes its leaves show them at (domeRingWarp): packed row
 * p of a band holds the map address band.y + (p − packedY) + ½ (createProjectiveSurfaceRasterPresentation), where the ring leaf's
 * texture parameter is u = (address − grown top) / grown height, and so the latitude L(u). The row is sampled from the map
 * there, longitudes as the packer lays them (with its wrap gutter). Rows of every other band stay as packed.
 */
export function writeDomeRings(packed: PackedBands, map: ObservedRgb, warp: DomeRingWarp, packingBoundsDegrees: readonly number[]) {
  const {width, height, channels} = map.info;
  if (packed.data.length !== packed.packedWidth * packed.packedHeight * channels || packed.packedWidth !== width + packed.gutter * 2)
    throw new TypeError(`A packed atlas of ${packed.packedWidth} × ${packed.packedHeight} does not hold a ${width} × ${height} map with ${channels} channels.`);
  for (const ring of warp) {
    const index = packingBoundsDegrees.findIndex((bound, position) => bound === ring.southDegrees && packingBoundsDegrees[position + 1] === ring.northDegrees);
    const band = packed.bands[index];
    if (index < 0 || !band) throw new TypeError(`Dome ring ${ring.southDegrees}–${ring.northDegrees}° is not a packed band of ${packingBoundsDegrees.join(', ')}.`);
    const exactHeight = (ring.northDegrees - ring.southDegrees) / 180 * height, grow = ring.bleed * exactHeight;
    const exactTop = (90 - ring.northDegrees) / 180 * height - grow;
    for (let local = -packed.gutter; local < band.height + packed.gutter; local++) {
      const address = band.y + local + 0.5, u = (address - exactTop) / (exactHeight + 2 * grow);
      const sourceY = Math.max(0, Math.min(height - 1, (90 - ring.latitudeAt(u)) / 180 * height - 0.5));
      const y0 = Math.floor(sourceY), y1 = Math.min(height - 1, y0 + 1), t = sourceY - y0, row = band.packedY + local;
      for (let x = 0; x < packed.packedWidth; x++) {
        const sourceX = (x - packed.gutter + width) % width;
        for (let channel = 0; channel < channels; channel++) {
          const top = map.data[(y0 * width + sourceX) * channels + channel]!, bottom = map.data[(y1 * width + sourceX) * channels + channel]!;
          packed.data[(row * packed.packedWidth + x) * channels + channel] = Math.round(top + (bottom - top) * t);
        }
      }
    }
  }
  return packed;
}
