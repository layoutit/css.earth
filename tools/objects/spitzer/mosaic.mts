#!/usr/bin/env node
/** Re-make a pinned observation's level-2 mosaics from its level-1 frames.
 *
 *   node tools/objects/spitzer/mosaic.mts <program id> [--channels 1,2] [--data <dir>] [--work <dir>]
 *
 * The inputs are checked against the program's pins before anything reads them, so a run cannot quietly use different bytes
 * than the ones the program names. Which frames go in is read from the observation, not chosen here: the archive's mosaic
 * carries the frame time it combined, and in IRAC High Dynamic Range mode that is half the frames in the AOR. A run whose
 * membership does not match refuses rather than producing a mosaic of the wrong exposures.
 *
 * The work itself is mosaic.py in the pinned environment. Beside each output this stage writes the shared
 * `cssearth-telescope-product@1` record: the exact inputs, the parameters, the package versions and the toolchain digest that
 * made it. A second run with the same record and the same output bytes on disk does no work.
 *
 * The record's software list names astropy and reproject, not MOPEX, and the stage is called `open-remosaic` rather than
 * anything that reads as the observatory's pipeline. compare.mts writes the evidence, and it is `archive-agreement` of an
 * unofficial re-mosaic; what that does and does not establish is in docs/spitzer.md. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, positionalArguments, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { assertInputPins, fileSize, readProductRecord, sameRun, writeProductRecord, type ProductInput, type ProductRecord, type ProductRun } from '../product-record.mts';
import { defaultDataRoot, readSpitzerProgram, REPOSITORY, type SpitzerChannel, type SpitzerProgram } from './archive.mts';
import { spitzerSoftware, spitzerToolchain } from './toolchain.mts';

export const TELESCOPE = 'spitzer';
export const STAGE = 'open-remosaic';
/** The least fractional overlap an output pixel may have with a frame before that frame contributes to it. An exact overlap
 * divided by a sliver of area amplifies that frame's noise without adding signal, and the archive's product shows it: at 0.5
 * the frame edges agree, without it they are where the disagreement lives. */
export const FOOTPRINT_THRESHOLD = 0.5;
/** The reprojected stack is the run's peak allocation. A job predicted to need more than this refuses before it starts. */
export const MAX_STACK_BYTES = 1024 * 1024 * 1024;
/** How many passes of zero-mean additive background matching the frames get before they are averaged. IRAC frames of one map
 * do not share a background: in channel 3 of the proving observation the frames' own levels ran from 0.30 to 0.97 MJy/sr,
 * which is the size of the signal. Without this, that channel agreed with the archive's product over 71% of its pixels; with
 * it, 98%, and channels 1 and 4 did not move because their frames already shared a level. The observatory's own pipeline
 * applies an overlap correction here. */
export const BACKGROUND_MATCH_PASSES = 3;

/** Which imask bits reject a pixel, and why these.
 *
 * The imask file says what its own bits mean, in its own header, for the pipeline version that wrote it (`BIT00` to `BIT14`,
 * under the comment `mask pixel Bit representation`). That is the source used here, because it is pinned with the data and
 * cannot fall out of step with it. For AOR 4416768 it reads:
 *
 *   00 overall data quality   01 reserved                     02 optical ghost present    03 stray light present
 *   04 saturation corrected in pipeline                       05 muxbleed/bandwidth effect present
 *   06 banding present        07 column pulldown present      08 crosstalk present        09 pixel contains radhit
 *   10 latent image           11 flat field was not applied   12 pixel is not linear      13 uncorrected saturation
 *   14 data is bad or missing
 *
 * The distinction that matters is between a bit that says the pixel is unusable and a bit that says an artifact was found and
 * dealt with. Bits 4, 5, 6 and 7 are the second kind: saturation corrected, muxbleed, banding and column pulldown are exactly
 * the artifacts the corrected frame (`cbcd`) has had removed, and this stage reads the corrected frame. Rejecting them throws
 * away good pixels, and because a detector column falls on nearly the same sky in every frame of a small dither, nothing
 * fills the gap: it drew the muxbleed rows and pulldown columns of the proving observation as empty, over 2.57% of the
 * pixels the archive covers.
 *
 * So what is rejected is the rest: stray light (3), crosstalk (8), radhit (9) and latent image (10), which contaminate a
 * pixel and are not corrected, and flat field not applied (11), not linear (12), uncorrected saturation (13) and bad or
 * missing (14), where the value is not a measurement. Measured on channel 1 against the archive's own mosaic, against
 * rejecting every non-zero bit: holes 2.57% to 0.33%, pixels inside the archive's stated uncertainty 98.11% to 99.08%,
 * correlation 0.9842 to 0.9943, median ratio 0.999856 to 0.999860. */
export const FATAL_IMASK_BITS = [3, 8, 9, 10, 11, 12, 13, 14] as const;
export const fatalImaskMask = FATAL_IMASK_BITS.reduce((mask, bit) => mask | (1 << bit), 0);
export const defaultWorkRoot = resolve(REPOSITORY, 'output/spitzer');

export interface MosaicSummary {
  readonly frames: number;
  readonly shape: readonly [number, number];
  readonly stackBytes: number;
  readonly coveredPixels: number;
  readonly maxContributingFrames: number;
  readonly medianContributingFrames: number;
  /** The additive offset each frame was put on, in the mosaic's own units, in the order the frames were combined. They sum to
   * zero by construction, so this says how far apart the frames were, not where the mosaic's level was moved to. */
  readonly backgroundOffsets: readonly number[];
  /** The archive's grid, which this run resampled onto, and the grid the pinned frames imply on their own. They are reported
   * together because the first is borrowed: a re-mosaic on someone else's geometry has not chosen a geometry. */
  readonly archiveGrid: MosaicGrid;
  readonly gridImpliedByFrames: MosaicGrid;
}
export interface MosaicGrid { readonly shape: readonly [number, number]; readonly crval: readonly [number, number]; readonly pixelScaleArcsec: number }

const pair = (raw: unknown, label: string): [number, number] => {
  const values = Array.isArray(raw) ? raw : [];
  if (values.length !== 2) throw new TypeError(`${label} is not a pair.`);
  return [requireFiniteNumber(values[0], label), requireFiniteNumber(values[1], label)];
};
const grid = (value: unknown, label: string): MosaicGrid => {
  const entry = requireRecord(value, label);
  return { shape: pair(entry.shape, `${label} shape`), crval: pair(entry.crval, `${label} crval`), pixelScaleArcsec: requireFiniteNumber(entry.pixelScaleArcsec, `${label} pixel scale`) };
};

export function parseMosaicSummary(value: unknown): MosaicSummary {
  const entry = requireRecord(value, 'mosaic summary');
  const shape = pair(entry.shape, 'mosaic shape');
  return { frames: requireFiniteNumber(entry.frames, 'frames'), shape, stackBytes: requireFiniteNumber(entry.stackBytes, 'stack bytes'),
    coveredPixels: requireFiniteNumber(entry.coveredPixels, 'covered pixels'),
    maxContributingFrames: requireFiniteNumber(entry.maxContributingFrames, 'max contributing frames'),
    medianContributingFrames: requireFiniteNumber(entry.medianContributingFrames, 'median contributing frames'),
    backgroundOffsets: requireArray(entry.backgroundOffsets, 'background offsets').map(value => requireFiniteNumber(value, 'background offset')),
    archiveGrid: grid(entry.archiveGrid, 'archive grid'), gridImpliedByFrames: grid(entry.gridImpliedByFrames, 'frame grid') };
}

/** The frames of a channel that made the archive's mosaic: the ones whose commanded frame time is the mosaic's. In High
 * Dynamic Range mode an AOR holds two frame times at each pointing and the archive mosaics one of them. */
export const mosaicMembers = (channel: SpitzerChannel) => channel.frames.filter(frame => frame.frameTimeSeconds === channel.mosaicFrameTimeSeconds);

/** Every pinned file a channel's re-mosaic reads, as product-record inputs. The archive's own mosaic is an input because the
 * run resamples onto its grid; it is named `archive-mosaic` so no reader mistakes it for something the run produced. */
export async function channelInputs(program: SpitzerProgram, channel: SpitzerChannel, directory: string): Promise<ProductInput[]> {
  const inputs: ProductInput[] = [];
  const reference = channel.products.find(product => product.role === 'mosaic');
  if (!reference) throw new Error(`Channel ${channel.channel} pins no archive mosaic.`);
  inputs.push({ role: 'archive-mosaic', identity: reference.name, bytes: reference.bytes });
  for (const frame of mosaicMembers(channel))
    for (const file of frame.files) if (file.role !== 'frame-uncertainty')
      inputs.push({ role: file.role, identity: file.name, bytes: file.bytes });
  if (!inputs.some(input => input.role === 'frame')) throw new Error(`Channel ${channel.channel}: no frame has the mosaic's frame time of ${channel.mosaicFrameTimeSeconds} s.`);
  return inputs;
}

const runPython = (python: string, env: NodeJS.ProcessEnv, args: readonly string[]) => new Promise<string>((done, fail) => {
  const child = spawn(python, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { out += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { err += chunk; });
  child.on('error', fail);
  child.on('close', code => code === 0 ? done(out) : fail(new Error(`mosaic.py failed (status ${code}): ${err.slice(-4000)}`)));
});

export const mosaicName = (program: SpitzerProgram, channel: number) => `${program.id}.ch${channel}.remosaic.fits`;

/** Re-make one channel's mosaic. Returns the record beside it, whether this run wrote it or an earlier identical run did. */
export async function remosaicChannel(program: SpitzerProgram, channel: SpitzerChannel, dataRoot: string, workRoot: string): Promise<{ record: ProductRecord; summary: MosaicSummary | null; reused: boolean }> {
  const toolchain = await spitzerToolchain(), software = await spitzerSoftware(toolchain);
  const directory = resolve(dataRoot, program.id, `ch${channel.channel}`);
  const work = resolve(workRoot, program.id);
  await mkdir(work, { recursive: true });
  const inputs = await channelInputs(program, channel, directory);
  const members = mosaicMembers(channel);
  const parameters = { combine: 'mean', weighting: 'equal per contributing frame', footprintThreshold: FOOTPRINT_THRESHOLD,
    resampling: 'reproject.reproject_exact', grid: "the archive mosaic's own",
    maskRejects: `imask bits ${FATAL_IMASK_BITS.join(', ')} (contaminated or not a measurement); the artifacts the corrected frame already had removed are kept`,
    backgroundMatchPasses: BACKGROUND_MATCH_PASSES,
    frameTimeSeconds: channel.mosaicFrameTimeSeconds, frames: members.map(frame => frame.dce) };
  const run: ProductRun = { telescope: TELESCOPE, stage: STAGE, inputs, parameters, software, toolchainDigest: toolchain.digest };
  const output = mosaicName(program, channel.channel);
  const recordPath = resolve(work, `${output}.product.json`);
  // Before anything else, including the decision to reuse: every pinned level-1 frame, its mask and the archive mosaic this
  // run resamples onto must be the bytes the program pinned. Checking after the reuse shortcut would let a run hand back a
  // record naming inputs that are no longer on disk.
  await assertInputPins(inputs, new Map(inputs.map(input => [input.identity, resolve(directory, input.identity)])));
  const existing = await readProductRecord(recordPath);
  if (await sameRun(existing, run, path => resolve(work, path))) return { record: existing!, summary: null, reused: true };

  const job = {
    reference: resolve(directory, channel.products.find(product => product.role === 'mosaic')!.name),
    frames: members.map(frame => ({
      image: resolve(directory, frame.files.find(file => file.role === 'frame')!.name),
      mask: resolve(directory, frame.files.find(file => file.role === 'frame-mask')!.name),
    })),
    output: resolve(work, output), footprintThreshold: FOOTPRINT_THRESHOLD, maxStackBytes: MAX_STACK_BYTES,
    backgroundMatchPasses: BACKGROUND_MATCH_PASSES, fatalImaskBits: fatalImaskMask,
  };
  const jobPath = resolve(work, `${output}.job.json`);
  await writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`);
  const summary = parseMosaicSummary(JSON.parse(await runPython(toolchain.python, toolchain.env, [resolve(import.meta.dirname, 'mosaic.py'), jobPath])) as unknown);
  if (summary.frames !== members.length) throw new Error(`The run combined ${summary.frames} frames; the observation names ${members.length}.`);
  // No evidence here: this stage made the product, it did not check it. compare.mts adds the `archive-agreement` entry to
  // this same record once it has compared the pinned bytes.
  const record = await writeProductRecord(recordPath, run, [{ path: output, file: resolve(work, output), units: channel.mosaic.units,
    conventions: { grid: "the archive level-2 mosaic's own WCS", projection: 'gnomonic (TAN), no distortion on the output grid', pipeline: 'open re-mosaic, not the Spitzer Science Center pipeline' } }]);
  return { record, summary, reused: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id] = positionalArguments(args, ['--channels', '--data', '--work']);
  if (!id) throw new TypeError('Usage: mosaic <program id> [--channels 1,2] [--data <dir>] [--work <dir>]');
  const program = await readSpitzerProgram(id);
  const wanted = flagValue(args, '--channels')?.split(',').map(entry => Number(entry.trim()));
  const dataRoot = flagValue(args, '--data') ?? defaultDataRoot, workRoot = flagValue(args, '--work') ?? defaultWorkRoot;
  for (const channel of program.channels.filter(entry => !wanted || wanted.includes(entry.channel))) {
    const { record, summary, reused } = await remosaicChannel(program, channel, dataRoot, workRoot);
    const output = record.outputs[0]!;
    if (reused) console.log(`ch${channel.channel}: ${output.path} is already the product of this run.`);
    else console.log(`ch${channel.channel}: ${output.path}, ${summary!.frames} frames, ${summary!.coveredPixels} covered pixels, up to ${summary!.maxContributingFrames} frames deep, stack ${(summary!.stackBytes / 1e6).toFixed(0)} MB.\n` +
      `  grid: archive ${summary!.archiveGrid.shape.join(' x ')} at ${summary!.archiveGrid.pixelScaleArcsec.toFixed(3)}"; the frames on their own imply ${summary!.gridImpliedByFrames.shape.join(' x ')} at ${summary!.gridImpliedByFrames.pixelScaleArcsec.toFixed(3)}".\n` +
      `  background offsets across the frames: ${(Math.max(...summary!.backgroundOffsets) - Math.min(...summary!.backgroundOffsets)).toPrecision(3)} ${channel.mosaic.units} from lowest to highest.`);
  }
}
