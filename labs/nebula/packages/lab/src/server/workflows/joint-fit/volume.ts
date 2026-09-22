/** Offline transport from a bounded analytic emission sampler to one neutral PolyCSS volume. */
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Bounds3, Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import { containedPath, sha256 } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { bakeMasterVolumeSlices, type MasterSliceProgress } from '@cssearth/volume-bake/slices/emission';
import type { JointVolumeResult } from '@cssearth/volume-core/contracts/joint-volume';

export type { JointVolumePin, JointVolumeResult } from '@cssearth/volume-core/contracts/joint-volume';
export interface JointVolumeProgress {
  phase: 'volume' | 'compile'; completed: number; total: number; message: string;
}
export interface BakeJointVolumeOptions {
  root: string;
  outputDirectory: string;
  id: string;
  boundsArcsec: Bounds3;
  /** Relative display emissivity per arcsecond. The callback must overwrite all channels. */
  sampleEmission(xWestArcsec: number, yNorthArcsec: number, zAwayArcsec: number, outRgb: Vector3): void;
  signal?: AbortSignal;
  progress?(progress: JointVolumeProgress): void;
}

const sliceCounts = { x: 48 as const, y: 48 as const, z: 48 as const };
const imageWidth = 256 as const, samplesPerSlab = 2 as const;
const cancellation = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Joint volume bake cancelled.', 'AbortError');
};
const normalizedPath = (path: string) => path.split('\\').join('/');

/** The scene is render-local: one unit is one arcsecond, centered on the supplied bounds. */
export async function bakeJointVolume(options: BakeJointVolumeOptions): Promise<JointVolumeResult> {
  const { root, outputDirectory, id, boundsArcsec, signal, progress } = options;
  if (!isAbsolute(root) || isAbsolute(outputDirectory) || !outputDirectory ||
      !/^[a-z0-9][a-z0-9-]{0,95}$/.test(id) || typeof options.sampleEmission !== 'function') {
    throw new TypeError('Joint volume identity and paths are invalid.');
  }
  const min = boundsArcsec?.min, max = boundsArcsec?.max;
  if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 3 || max.length !== 3 ||
      min.some((value, axis) => !Number.isFinite(value) || !Number.isFinite(max[axis]) || value >= max[axis]!)) {
    throw new TypeError('Joint volume bounds must contain finite increasing XYZ intervals.');
  }
  cancellation(signal);
  const output = containedPath(root, outputDirectory);
  await mkdir(output, { recursive: true });
  const origin = min.map((value, axis) => (value + max[axis]!) / 2) as Vector3;
  const localBounds: Bounds3 = { min: min.map((value, axis) => value - origin[axis]!) as Vector3,
    max: max.map((value, axis) => value - origin[axis]!) as Vector3 };
  const provenance = {
    schema: 'cssearth-joint-fit-volume-provenance@1',
    input: 'Caller-supplied analytic relative-emission sampler; no photograph pixels are read by this baker.',
    coordinates: { axes: ['west', 'north', 'away'], units: 'arcsec', localOriginArcsec: origin,
      mapping: 'sourceArcsec = localUnits + localOriginArcsec', earthView: 'observer-at-negative-z-looking-away' },
    boundsArcsec: { min: [...min], max: [...max] },
    limitations: ['Relative display emission only; this transport does not define or validate the scientific model.',
      'Angular depth is an authored reconstruction coordinate, not a measured line-of-sight distance.',
      'Finite slabs, two depth samples per slab and RGBA8 opacity approximate the continuous input field.'],
  };
  let calls = 0;
  const { masters } = await bakeMasterVolumeSlices({
    boundsKpc: localBounds, sliceCounts, samplesPerSlab, exposureGain: 1, masterWidth: imageWidth,
    masterDirectory: output, deliveryBanks: [], unitsPerSourceUnit: 1, provenance,
    cropTransparent: true, sampleEmission(x, y, z, out) {
      if ((++calls & 0xffff) === 0) cancellation(signal);
      options.sampleEmission(x + origin[0], y + origin[1], z + origin[2], out);
    },
    onProgress: (event: MasterSliceProgress) => {
      cancellation(signal);
      progress?.({ phase: 'volume', completed: event.completed, total: event.total,
        message: `Preparing ${event.axis.toUpperCase()} joint-fit slabs` });
    },
  });
  cancellation(signal);
  const frame: DensityVolumeFrame = { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: localBounds };
  progress?.({ phase: 'compile', completed: 0, total: 1, message: 'Compiling retained joint-fit scene' });
  const prepared = validatePreparedCssVolume(compileCssVolume({ id: `joint-fit-${id}`, frame, slices: masters, recipe: { anchors: [] } }));
  const bytes = Buffer.from(JSON.stringify(prepared) + '\n');
  const path = normalizedPath(relative(root, resolve(output, 'volume.json')));
  await writeFile(containedPath(root, path), bytes);
  cancellation(signal);
  progress?.({ phase: 'compile', completed: 1, total: 1, message: 'Prepared retained joint-fit scene' });
  return { schema: 'cssearth-joint-fit-volume@1', id, volume: { path }, frame,
    boundsArcsec: { min: [...min] as Vector3, max: [...max] as Vector3 },
    coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin,
      earthView: 'observer-at-negative-z-looking-away' },
    sampling: { sliceCounts, imageWidth, samplesPerSlab } };
}
