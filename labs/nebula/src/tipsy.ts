/** Offline Tipsy float32 star extraction. Format reference:
 * https://github.com/pynbody/pynbody/blob/master/pynbody/snapshot/tipsy.py
 * Header: double time + six int32; families: gas, dark matter, stars.
 * Particle records have 12/9/11 float32 values respectively; mass precedes xyz.
 * No stellar ages, luminosities, colors, gas or dust are inferred here.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type Vec3 = [number, number, number];
type Endian = 'little' | 'big';
export interface TipsyCounts {
  totalCount: number;
  gasCount: number;
  darkCount: number;
  starCount: number;
}
export interface TipsyHeader extends TipsyCounts {
  endian: Endian;
  timeRaw: number;
  dimensions: 3;
  headerBytes: 32;
  layout: 'float32';
  expectedBytes: number;
  starByteOffset: number;
}
export interface TipsyImportOptions {
  snapshotPath: string;
  outputPath: string;
  /** Half-open range within the star family, never the entire particle array. */
  starRange: { start: number; count: number };
  positionUnit: 'kpc';
  /** Solar masses represented by one unchanged source/output mass value. */
  massUnitSolarMass: number;
  center?: 'none' | 'median';
  layout?: 'float32';
  expected?: Partial<TipsyCounts> & { snapshotSha256?: string };
}
interface AxisStatistics {
  boundsKpc: { min: Vec3; max: Vec3 };
  quantilesKpc: { probability: number; position: Vec3 }[];
}
export interface TipsyImportReceipt {
  schema: 'cssearth-tipsy-stars-lab@1';
  source: { path: string; sha256: string; bytes: number; header: TipsyHeader };
  selection: {
    family: 'stars'; start: number; count: number; endExclusive: number;
    firstSourceByte: number; sourceRecordBytes: 44;
  };
  units: { position: 'kpc'; massUnitSolarMass: number; time: 'uninterpreted-source-value' };
  centering: { method: 'none' | 'median'; offsetKpc: Vec3; operation: string };
  sourceStatistics: AxisStatistics;
  outputStatistics: AxisStatistics;
  mass: { sumSourceUnits: number; sumSolarMass: number; minSourceUnits: number; maxSourceUnits: number };
  output: {
    path: string; sha256: string; bytes: number; count: number;
    layout: 'float32-le-xyz-mass'; recordBytes: 16;
    maximumPositionRoundingErrorKpc: Vec3;
  };
  interpretation: string;
}

const HEADER_BYTES = 32;
const GAS_BYTES = 48;
const DARK_BYTES = 36;
const STAR_BYTES = 44;
const RECORD_BYTES = 16;
const BLOCK_RECORDS = 65_536;
const PROBABILITIES = [0.01, 0.05, 0.5, 0.95, 0.99];

function integer(value: number, name: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer >= ${minimum}.`);
  }
}

/** Accept only the documented 32-byte header and exact all-float32 file length. */
export function parseTipsyHeader(bytes: Uint8Array, totalBytes: number): TipsyHeader {
  if (bytes.byteLength < HEADER_BYTES) throw new TypeError('Truncated Tipsy header.');
  integer(totalBytes, 'Tipsy file size', HEADER_BYTES);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = view.getInt32(12, true) === 3;
  const big = view.getInt32(12, false) === 3;
  if (little === big) throw new TypeError('Unsupported Tipsy dimensions/endian: expected ndim=3.');
  const timeRaw = view.getFloat64(0, little);
  if (!Number.isFinite(timeRaw)) throw new TypeError('Tipsy time must be finite.');
  const counts: TipsyCounts = {
    totalCount: view.getInt32(8, little), gasCount: view.getInt32(16, little),
    darkCount: view.getInt32(20, little), starCount: view.getInt32(24, little),
  };
  for (const [name, count] of Object.entries(counts)) integer(count, name);
  if (view.getInt32(28, little) !== 0) {
    throw new TypeError('Unsupported Tipsy extended-count/padding header; only zero padding is supported.');
  }
  if (counts.totalCount !== counts.gasCount + counts.darkCount + counts.starCount) {
    throw new TypeError('Tipsy total count does not equal gas + dark + stars.');
  }
  const starByteOffset = HEADER_BYTES + counts.gasCount * GAS_BYTES + counts.darkCount * DARK_BYTES;
  const expectedBytes = starByteOffset + counts.starCount * STAR_BYTES;
  integer(expectedBytes, 'Expected Tipsy file size', HEADER_BYTES);
  if (totalBytes !== expectedBytes) {
    throw new TypeError(`Unsupported Tipsy layout or truncated/extra data: float32 requires ${expectedBytes} bytes, received ${totalBytes}. Double precision is not supported.`);
  }
  return {
    ...counts, endian: little ? 'little' : 'big', timeRaw, dimensions: 3,
    headerBytes: 32, layout: 'float32', expectedBytes, starByteOffset,
  };
}

async function readExactly(file: FileHandle, buffer: Buffer, position: number): Promise<void> {
  let filled = 0;
  while (filled < buffer.length) {
    const { bytesRead } = await file.read(buffer, filled, buffer.length - filled, position + filled);
    if (bytesRead === 0) throw new TypeError('Tipsy file ended during extraction.');
    filled += bytesRead;
  }
}

function quantile(sorted: Float32Array, probability: number): number {
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function statistics(sortedAxes: Float32Array[]): AxisStatistics {
  return {
    boundsKpc: {
      min: sortedAxes.map(axis => axis[0]) as Vec3,
      max: sortedAxes.map(axis => axis[axis.length - 1]) as Vec3,
    },
    quantilesKpc: PROBABILITIES.map(probability => ({
      probability, position: sortedAxes.map(axis => quantile(axis, probability)) as Vec3,
    })),
  };
}

function validateOptions(options: TipsyImportOptions): void {
  if (options.positionUnit !== 'kpc') throw new TypeError('Explicit positionUnit kpc is required.');
  if (!Number.isFinite(options.massUnitSolarMass) || options.massUnitSolarMass <= 0) {
    throw new TypeError('massUnitSolarMass must be finite and positive.');
  }
  if (options.center !== undefined && options.center !== 'none' && options.center !== 'median') {
    throw new TypeError('Unsupported center; expected none or median.');
  }
  if (options.layout !== undefined && options.layout !== 'float32') {
    throw new TypeError('Only the float32 Tipsy layout is supported.');
  }
  integer(options.starRange.start, 'Star range start');
  integer(options.starRange.count, 'Star range count', 1);
  integer(options.starRange.start + options.starRange.count, 'Star range end');
  if (resolve(options.snapshotPath) === resolve(options.outputPath)) {
    throw new TypeError('Output must not replace the source snapshot.');
  }
  const expected = options.expected;
  if (expected?.snapshotSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expected.snapshotSha256)) {
    throw new TypeError('Expected snapshot SHA-256 must be lowercase hexadecimal.');
  }
  for (const key of ['totalCount', 'gasCount', 'darkCount', 'starCount'] as const) {
    if (expected?.[key] !== undefined) integer(expected[key], `Expected ${key}`);
  }
}

/** Extract selected real source records; ZIP handling and source attribution belong to the caller. */
export async function importTipsyStars(options: TipsyImportOptions): Promise<TipsyImportReceipt> {
  validateOptions(options);
  const file = await open(options.snapshotPath, 'r');
  try {
    const before = await file.stat();
    if (!before.isFile()) throw new TypeError('Tipsy source must be a regular file.');
    const headerBytes = Buffer.alloc(HEADER_BYTES);
    await readExactly(file, headerBytes, 0);
    const header = parseTipsyHeader(headerBytes, before.size);
    for (const key of ['totalCount', 'gasCount', 'darkCount', 'starCount'] as const) {
      if (options.expected?.[key] !== undefined && options.expected[key] !== header[key]) {
        throw new TypeError(`Tipsy ${key} differs from the expected source count.`);
      }
    }
    const { start, count } = options.starRange;
    if (start + count > header.starCount) throw new RangeError('Requested range exceeds the Tipsy star family.');
    const sourceHash = createHash('sha256');
    for await (const chunk of file.createReadStream({ start: 0, autoClose: false })) sourceHash.update(chunk);
    const snapshotSha256 = sourceHash.digest('hex');
    if (options.expected?.snapshotSha256 !== undefined && snapshotSha256 !== options.expected.snapshotSha256) {
      throw new TypeError('Tipsy snapshot SHA-256 differs from the pinned source.');
    }
    const firstSourceByte = header.starByteOffset + start * STAR_BYTES;
    const output = Buffer.alloc(count * RECORD_BYTES);
    const axes = [new Float32Array(count), new Float32Array(count), new Float32Array(count)];
    let massSum = 0, massCorrection = 0, minMass = Infinity, maxMass = -Infinity;
    for (let first = 0; first < count; first += BLOCK_RECORDS) {
      const blockCount = Math.min(BLOCK_RECORDS, count - first);
      const block = Buffer.alloc(blockCount * STAR_BYTES);
      await readExactly(file, block, firstSourceByte + first * STAR_BYTES);
      const read = (offset: number) => header.endian === 'little' ? block.readFloatLE(offset) : block.readFloatBE(offset);
      for (let index = 0; index < blockCount; index++) {
        const sourceOffset = index * STAR_BYTES, particle = first + index;
        const mass = read(sourceOffset);
        if (!Number.isFinite(mass) || mass < 0) throw new TypeError(`Invalid mass in source star ${start + particle}.`);
        const compensated = mass - massCorrection, total = massSum + compensated;
        massCorrection = (total - massSum) - compensated;
        massSum = total;
        minMass = Math.min(minMass, mass); maxMass = Math.max(maxMass, mass);
        output.writeFloatLE(mass, particle * RECORD_BYTES + 12);
        for (let axis = 0; axis < 3; axis++) {
          const value = read(sourceOffset + 4 + axis * 4);
          if (!Number.isFinite(value)) throw new TypeError(`Nonfinite position in source star ${start + particle}.`);
          axes[axis][particle] = value;
          output.writeFloatLE(value, particle * RECORD_BYTES + axis * 4);
        }
      }
    }
    const after = await file.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
      throw new TypeError('Tipsy source changed while being read.');
    }
    const massSolar = massSum * options.massUnitSolarMass;
    if (!Number.isFinite(massSolar)) throw new TypeError('Selected total mass overflows its physical units.');
    for (const axis of axes) axis.sort();
    const sourceStatistics = statistics(axes), method = options.center ?? 'none';
    const offsetKpc = (method === 'median' ? axes.map(axis => quantile(axis, 0.5)) : [0, 0, 0]) as Vec3;
    const maximumPositionRoundingErrorKpc: Vec3 = [0, 0, 0];
    if (method === 'median') {
      for (let particle = 0; particle < count; particle++) {
        for (let axis = 0; axis < 3; axis++) {
          const offset = particle * RECORD_BYTES + axis * 4;
          const exact = output.readFloatLE(offset) - offsetKpc[axis], stored = Math.fround(exact);
          if (!Number.isFinite(stored)) throw new TypeError('Centered position exceeds float32 range.');
          output.writeFloatLE(stored, offset);
          maximumPositionRoundingErrorKpc[axis] = Math.max(maximumPositionRoundingErrorKpc[axis], Math.abs(stored - exact));
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        for (let index = 0; index < count; index++) axes[axis][index] -= offsetKpc[axis];
      }
    }
    const receipt: TipsyImportReceipt = {
      schema: 'cssearth-tipsy-stars-lab@1',
      source: { path: options.snapshotPath, sha256: snapshotSha256, bytes: before.size, header },
      selection: { family: 'stars', start, count, endExclusive: start + count, firstSourceByte, sourceRecordBytes: 44 },
      units: { position: 'kpc', massUnitSolarMass: options.massUnitSolarMass, time: 'uninterpreted-source-value' },
      centering: { method, offsetKpc, operation: 'output xyz = float32(source xyz - offsetKpc); source axes are not rotated or rescaled' },
      sourceStatistics, outputStatistics: statistics(axes),
      mass: { sumSourceUnits: massSum, sumSolarMass: massSolar, minSourceUnits: minMass, maxSourceUnits: maxMass },
      output: { path: options.outputPath, sha256: createHash('sha256').update(output).digest('hex'), bytes: output.length,
        count, layout: 'float32-le-xyz-mass', recordBytes: 16, maximumPositionRoundingErrorKpc },
      interpretation: 'Simulation star-family particles, not observed individual stars. Source masses are unchanged; no ages, populations, luminosities or dust are inferred.',
    };
    await mkdir(dirname(resolve(options.outputPath)), { recursive: true });
    const temporary = `${resolve(options.outputPath)}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, output, { flag: 'wx' });
      await rename(temporary, options.outputPath);
    } finally {
      await rm(temporary, { force: true });
    }
    return receipt;
  } finally {
    await file.close();
  }
}
