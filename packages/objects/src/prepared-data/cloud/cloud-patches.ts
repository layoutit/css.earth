import { preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../../density-volume.js';

/**
 * Cloud patches (`cssearth-cloud-patches@1`): a cloud-point bank (cloud-points.ts) drawn as fixed textured quads in the
 * bank's frame instead of dots reprojected on every paint. Each clump of points is two or three crossed quads, so it never
 * vanishes edge-on, each quad one PolyCSS leaf: a `cellPx` square box cut from one prepared atlas of soft Gaussian cells
 * (one a color and opacity step) and placed by its own matrix. Camera motion moves only the scene that holds them.
 *
 * The bake (packages/bake/cli/prepare-cloud-patches.mts) writes the quad's matrix whole, in the volume scene's CSS
 * pixels (CSS x along the bank's y, CSS y along its x, CSS z along its z, 50 px to the unit, as image-layer surface
 * patches are written): the runtime only formats it. A bank at `prepared/<id>-patches.bin` beside a volume-dataset or
 * image-layer bank (`properties.cloudPatches`).
 */
export const PREPARED_CLOUD_PATCHES_SCHEMA = 'cssearth-cloud-patches@1';
export interface PreparedCloudPatches {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  /** Quads (leaves), not clumps. */
  readonly count: number;
  /** The atlas of soft cells beside the bank (a prepared file) and its size in pixels. */
  readonly atlas: { readonly file: string; readonly width: number; readonly height: number };
  /** A cell's side, and each leaf's box, in pixels. */
  readonly cellPx: number;
  /** Each quad's matrix3d without its constant column: 12 numbers, a b c, d e f, g h i, then the corner's x y z. */
  readonly matrices: Float32Array;
  /** Each quad's cell: its left and top in the atlas, in pixels. */
  readonly cells: Uint16Array;
}

export function encodeCloudPatches(patches: PreparedCloudPatches): PreparedBank {
  return { schema: PREPARED_CLOUD_PATCHES_SCHEMA, fields: { id: patches.id, frame: patches.frame, count: patches.count, atlas: patches.atlas, cellPx: patches.cellPx },
    columns: { matrix: patches.matrices, cell: patches.cells } };
}

/** A fetched bank, checked: its frame, its atlas, a finite matrix for every quad and a cell inside the atlas. */
export function readCloudPatches(bank: PreparedBank, at = 'cloud patches'): PreparedCloudPatches {
  if (bank.schema !== PREPARED_CLOUD_PATCHES_SCHEMA) throw new TypeError(`${at}: expected ${PREPARED_CLOUD_PATCHES_SCHEMA}, got ${bank.schema}.`);
  const { id, frame, count, atlas, cellPx } = bank.fields as { id?: unknown; frame?: unknown; count?: unknown; atlas?: unknown; cellPx?: unknown };
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${at}: its id is a bank id, got ${JSON.stringify(id ?? null)}.`);
  if (!Number.isSafeInteger(count) || (count as number) < 0) throw new TypeError(`${at}: count is a count, got ${JSON.stringify(count ?? null)}.`);
  if (!Number.isSafeInteger(cellPx) || (cellPx as number) < 1) throw new TypeError(`${at}: cellPx is a positive whole number of pixels, got ${JSON.stringify(cellPx ?? null)}.`);
  const sheet = atlas as { file?: unknown; width?: unknown; height?: unknown } | undefined;
  if (!sheet || typeof sheet !== 'object' || typeof sheet.file !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/u.test(sheet.file) ||
    !Number.isSafeInteger(sheet.width) || !Number.isSafeInteger(sheet.height) || (sheet.width as number) < (cellPx as number) || (sheet.height as number) < (cellPx as number))
    throw new TypeError(`${at}: atlas is a prepared file name and its width and height, at least one cell, got ${JSON.stringify(atlas ?? null)}.`);
  const n = count as number, cell = cellPx as number, width = sheet.width as number, height = sheet.height as number;
  const matrices = preparedBankColumn(bank, 'matrix', 'f32', n * 12, at) as Float32Array, cells = preparedBankColumn(bank, 'cell', 'u16', n * 2, at) as Uint16Array;
  if (matrices.some(value => !Number.isFinite(value))) throw new TypeError(`${at}: every quad has a finite matrix.`);
  for (let i = 0; i < n; i++) if (cells[i * 2]! + cell > width || cells[i * 2 + 1]! + cell > height) throw new TypeError(`${at}: quad ${i}'s cell lies outside the atlas.`);
  return { id, frame: parseDensityVolumeFrame(frame), count: n, atlas: { file: sheet.file, width, height }, cellPx: cell, matrices, cells };
}
