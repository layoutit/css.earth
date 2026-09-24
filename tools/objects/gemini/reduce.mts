#!/usr/bin/env node
/** Re-run DRAGONS, Gemini Observatory's own reduction platform, on a pinned programme's raw frames.
 *
 *   node tools/objects/gemini/reduce.mts <program id> <work directory> <stage> [--raw <dir>] [--half a|b]
 *
 * Three stages, in the order a GMOS image needs them, each a plain `reduce` call on the pinned raw frames:
 *
 *   `bias`     the BIAS set's raw frames, combined into a master bias.
 *   `flat`     the FLAT set's raw twilight frames, bias-subtracted and combined into a master flat.
 *   `science`  the science frames, bias-subtracted, flat-fielded and stacked.
 *
 * **Calibrations are passed by hand, not through a database.** DRAGONS can keep a `caldb` and find its own calibrations, but
 * then what went into a product depends on what that database happened to hold. `--user_cal` names the exact file instead,
 * so each stage's inputs are the pinned ones and nothing else, and the product record can state them.
 *
 * Which bias each stage uses is decided by what is being reproduced, not by what is nearest:
 *
 * - `flat` uses **the archive's own bias master**, the one the archive's flat names in its `BIASIM` card. Reproducing the
 *   archive's flat means subtracting the bias the archive subtracted; using ours would make a different product that happens
 *   to look similar, and the comparison would no longer be about the flat step.
 * - `science` uses **our own** master bias and master flat, because the science stack is the thing being made here and there
 *   is no archive product of it to reproduce.
 *
 * `--half a|b` reduces one disjoint half of the science dither, so two stacks sharing no exposure can be compared. The
 * halves are interleaved rather than cut in the middle, so each holds dither positions from across the sequence instead of
 * one end of it.
 *
 * Every stage refuses inputs that are not the pinned ones (`assertInputPins`) **before** DRAGONS reads anything, writes a
 * `cssearth-telescope-product@1` record beside its product, and is skipped when that record says this same run already made
 * the files that are there (`sameRun`). Nothing needs a display: DRAGONS' interactive tools are not used and matplotlib is
 * forced to a non-interactive backend by the toolchain. */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, positionalArguments } from '@cssearth/core';
import { productRecordPath, readProductRecord, sameRun, writeProductRecord, assertInputPins,
  type ProductInput, type ProductRecord, type ProductRun } from '../product-record.mts';
import { digestProgram, readGeminiProgram, type GeminiFrame, type GeminiProgram } from './archive.mts';
import { geminiFile } from './cadc.mts';
import { dragonsToolchainVersions, geminiToolchain, type GeminiToolchain } from './toolchain.mts';

/** The stages this toolkit runs. Each calibration stage is named for the pinned set it reduces, so adding a set adds a
 * stage and nothing here has to learn a second vocabulary for the same thing. `flat-bias` is the bias the flat needs, and it
 * runs before `flat`. */
export const STAGES = ['bias', 'flat-bias', 'flat', 'science'] as const;
export type Stage = (typeof STAGES)[number];
export const HALVES = ['a', 'b'] as const;
export type Half = (typeof HALVES)[number];

/** A path inside the repository, as the repository sees it: a record is committed, so it never carries a local absolute
 * path. A path outside the repository is recorded as it is, because nothing here can shorten it honestly. */
const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const repositoryPath = (path: string) => path.startsWith(`${REPOSITORY}/`) ? path.slice(REPOSITORY.length + 1) : path;

/** What DRAGONS calls the product of each stage. `reduce` names its output for the first frame that went in and for what it
 * made, so a stage's product is found by that suffix rather than by guessing a name. The science recipe's own name for a
 * stacked, sky-subtracted GMOS image is `_image`, not `_stack`. */
export const PRODUCT_SUFFIX: Readonly<Record<Stage, string>> = { bias: '_bias.fits', 'flat-bias': '_bias.fits',
  flat: '_flat.fits', science: '_image.fits' };

/** The two disjoint halves of a dither sequence, interleaved.
 *
 * Interleaved and not cut in the middle: a dither walks the target around the detector, so the first half of a four-point
 * dither is two adjacent positions and the second is the other two. Taking every other frame gives each half positions from
 * across the sequence, which is what makes the two comparable. A sequence of fewer than four frames cannot be halved into
 * two stacks worth comparing and is refused rather than split into single frames. */
export function ditherHalf(frames: readonly GeminiFrame[], half: Half): GeminiFrame[] {
  if (frames.length < 4) throw new Error(`A dither of ${frames.length} frames does not split into two stacks; at least 4 are needed.`);
  return frames.filter((_, index) => index % 2 === (half === 'a' ? 0 : 1));
}

export interface StagePlan {
  readonly stage: Stage;
  /** The raw frames DRAGONS combines. */
  readonly frames: readonly GeminiFrame[];
  /** Calibrations given to `reduce` by name, as `processed_bias` / `processed_flat`. */
  readonly calibrations: Readonly<Record<string, GeminiFrame>>;
  /** The archive's own product for this stage, where it has one. */
  readonly archiveProduct: GeminiFrame | null;
  readonly parameters: Readonly<Record<string, unknown>>;
}

/** What a stage runs on, decided from the pinned program alone. Separated from running it so a test can check the plan
 * without DRAGONS installed and without a byte on disk. */
export function stagePlan(program: GeminiProgram, stage: Stage, half?: Half): StagePlan {
  if (stage === 'science') {
    const frames = half === undefined ? program.science : ditherHalf(program.science, half);
    return { stage, frames, calibrations: {}, archiveProduct: null,
      parameters: { recipe: 'default', combine: "DRAGONS' own reduce for GMOS imaging", ...(half === undefined ? {} : { half }),
        calibrationChoice: 'our own master bias and master flat, made by the bias and flat stages of this same toolkit' } };
  }
  const set = program.calibrations.find(entry => entry.id === stage);
  if (!set) throw new Error(`${program.id} pins no ${stage} set; it pins ${program.calibrations.map(entry => entry.id).join(', ') || 'none'}.`);
  return { stage, frames: set.frames, calibrations: {}, archiveProduct: set.product,
    parameters: { recipe: 'default', combine: `DRAGONS' own makeProcessed${set.kind === 'BIAS' ? 'Bias' : 'Flat'} for GMOS`,
      ...(set.requiresBias === undefined ? {} : { biasChoice:
        `our own ${set.requiresBias} master. The archive's flat names the IRAF bias it used, but that master is trimmed to a ` +
        'different detector section and DRAGONS refuses it rather than mis-applying it, so the bias is remade here from that ' +
        'master\'s own raw frames.' }) } };
}

/** Which stage, if any, must have run before this one. A set that declares a bias needs that set's stage first. */
export function stageRequires(program: GeminiProgram, stage: Stage): Stage[] {
  if (stage === 'science') return ['bias', 'flat'];
  const set = program.calibrations.find(entry => entry.id === stage);
  return set?.requiresBias ? [set.requiresBias as Stage] : [];
}

/** Where a stage runs and what it leaves behind. One directory per stage and half, so two halves never overwrite each
 * other's product and each keeps its own DRAGONS log beside it. */
export const stageDirectory = (work: string, stage: Stage, half?: Half) =>
  resolve(work, half === undefined ? stage : `${stage}-${half}`);
export const rawDirectory = (work: string) => resolve(work, 'raw');

/** What a run needs to know about itself, gathered once: the environment is asked for its versions a single time rather than
 * once per stage, and a test can supply them without DRAGONS installed. */
export interface RunContext {
  readonly program: GeminiProgram;
  readonly work: string;
  readonly software: readonly { name: string; version: string }[];
  readonly toolchainDigest: string;
}

/** The role `reduce` reads a stage's product under. A flat is the flat; every other calibration stage here makes a bias. */
export const calibrationRole = (stage: Stage) => stage === 'flat' ? 'processed_flat' : 'processed_bias';

/** The run that a stage of this program would be, exactly as `reduceStage` would record it.
 *
 * This is the one description of a stage's identity, and both the stage that writes a product and the stage that reuses one
 * ask for it. That is the whole point: a master may only be reused when the run that made it is the run this program's
 * current plan describes, and the two can only be compared if one function answers what that run is.
 *
 * It recurses through `stageRequires`, so the flat's run carries the bias its plan needs, and the science stage's run
 * carries both masters. The dependency graph is the one `stageRequires` describes and it has no cycles. */
export async function stageRun(context: RunContext, stage: Stage, half?: Half): Promise<{ run: ProductRun; plan: StagePlan; ours: OurCalibration[] }> {
  const plan = stagePlan(context.program, stage, half);
  const ours = await ourCalibrations(context, stageRequires(context.program, stage));
  const inputs = [...plan.frames.map(frame => inputPin(frame, `${stage} frame`)),
    ...Object.entries(plan.calibrations).map(([role, frame]) => inputPin(frame, role)), ...ours.map(entry => entry.input)];
  return { plan, ours, run: { telescope: 'gemini', stage: `gemini/${stage}${half ? `/${half}` : ''}`, inputs,
    parameters: { ...plan.parameters, programme: context.program.programme, instrument: context.program.instrument,
      filter: context.program.filter },
    software: context.software.map(entry => ({ name: entry.name, version: entry.version })), toolchainDigest: context.toolchainDigest } };
}

export interface OurCalibration { readonly role: string; readonly path: string; readonly input: ProductInput }

/** The calibrations this toolkit made, for a later stage to use.
 *
 * A science stack is bias-subtracted and flat-fielded with **our** masters, not the archive's, because the stack is the thing
 * being made here and nothing in the archive reproduces it.
 *
 * A master is only accepted when the record beside it describes **the run this program's current plan would make**, not
 * merely when the file still matches whatever record happens to sit next to it. Those are different checks and only the
 * first one is worth anything: a work directory outlives a pin, so a master left there by another program, or by an earlier
 * version of this one that named a different calibration set, is exactly the file that would otherwise be picked up and
 * silently folded into a new product. It is refused by name instead, and the stage that would remake it is named. */
export async function ourCalibrations(context: RunContext, stages: readonly Stage[]): Promise<OurCalibration[]> {
  const found: OurCalibration[] = [];
  for (const stage of stages) {
    const role = calibrationRole(stage);
    const directory = stageDirectory(context.work, stage), product = await currentProduct(directory, stage);
    if (!product) throw new Error(`This stage needs a ${stage} master: run \`reduce ${stage}\` in ${repositoryPath(context.work)} first.`);
    const record = await readProductRecord(resolve(directory, productRecordPath(product)));
    if (!record) throw new Error(`${product} has no product record beside it; it was not made by this toolkit.`);
    const { run: expected } = await stageRun(context, stage);
    if (!await sameRun(record, expected, output => resolve(directory, output)))
      throw new Error(`${product} in ${repositoryPath(directory)} was not made by this program's current ${stage} plan, or is `
        + `no longer the file its record pins. Re-run \`reduce ${stage}\`; a master from another program or another `
        + 'calibration set is never reused.');
    const output = record.outputs.find(entry => entry.path === product)!;
    found.push({ role, path: resolve(directory, product), input: { role, identity: product, bytes: output.bytes } });
  }
  return found;
}

/** The pinned files a stage needs on disk, downloaded or linked from a directory that already holds them. */
async function fetchFrames(frames: readonly GeminiFrame[], directory: string, sources: readonly string[]) {
  const paths = new Map<string, string>();
  for (const frame of frames) paths.set(frame.name, await geminiFile(frame, directory, sources));
  return paths;
}

/** Our sha256 of a pinned file, which is what `assertInputPins` checks. A pin that has none yet cannot be checked, and a
 * stage that ran on an unchecked input would be recording a guess, so it is refused and the digest step is named. */
const inputPin = (frame: GeminiFrame, role: string): ProductInput => {
  if (frame.sha256 === undefined)
    throw new Error(`${frame.name} carries no sha256 yet. Download it once so the pin can be digested before a reduction uses it.`);
  return { role, identity: frame.name, bytes: frame.bytes };
};

/** One `reduce` call. Non-zero status, or a run that leaves no product, is an error with DRAGONS' own last words attached:
 * the log is the only place that says why a recipe stopped. */
function runReduce(toolchain: GeminiToolchain, directory: string, files: readonly string[], userCal: readonly string[]) {
  const args = [...files, '--logmode', 'quiet', '--logfile', 'reduce.log',
    ...(userCal.length ? ['--user_cal', ...userCal] : [])];
  const started = process.hrtime.bigint();
  const result = spawnSync(toolchain.binaries.reduce!, args,
    { cwd: directory, encoding: 'utf8', env: { ...process.env, ...toolchain.env }, maxBuffer: 64 * 1024 * 1024 });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  if (result.status !== 0)
    throw new Error(`reduce failed (status ${result.status}): ${(result.stderr || result.stdout || '').slice(-4000)}`);
  return { seconds, arguments: args };
}

export interface Reduction {
  readonly stage: Stage;
  readonly half?: Half;
  /** The product's file name, as DRAGONS named it. */
  readonly product: string;
  readonly record: ProductRecord;
  readonly seconds: number;
}

/** Run one stage, or keep what a previous identical run left.
 *
 * The order is deliberate: the plan is made, the inputs are pinned, the pins are checked against the files on disk, and only
 * then does DRAGONS see anything. An input that changed stops the stage instead of reaching a product that claims to have
 * been made from the pinned frames. */
export async function reduceStage(program: GeminiProgram, work: string, stage: Stage,
  options: { half?: Half; sources?: readonly string[]; toolchain?: GeminiToolchain } = {}): Promise<Reduction> {
  const toolchain = options.toolchain ?? await geminiToolchain();
  const directory = stageDirectory(work, stage, options.half), raw = rawDirectory(work);
  // The files come first, then their digests, then the pins: a pin's sha256 is ours and is taken from the bytes the archive
  // actually sent, so it cannot exist before the first download. Everything after this point is checked against it.
  const wanted = stagePlan(program, stage, options.half);
  const files = await fetchFrames([...wanted.frames, ...Object.values(wanted.calibrations)], raw, options.sources ?? []);
  const digested = await digestProgram(program, raw);
  const context: RunContext = { program: digested, work, software: dragonsToolchainVersions(toolchain), toolchainDigest: toolchain.digest };
  const { run, plan, ours } = await stageRun(context, stage, options.half);

  const existing = await currentProduct(directory, stage);
  if (existing) {
    const record = await readProductRecord(resolve(directory, productRecordPath(existing)));
    if (await sameRun(record, run, output => resolve(directory, output)))
      return { stage, ...(options.half ? { half: options.half } : {}), product: existing, record: record!, seconds: 0 };
  }

  // Every input, wherever it lives: the raw frames under the work directory's `raw`, and the masters this toolkit made in
  // their own stage directories. All of them are checked against their pins before DRAGONS opens anything.
  const located = new Map([...files, ...ours.map(entry => [entry.input.identity, entry.path] as const)]);
  await assertInputPins(run.inputs, located);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const userCal = [...Object.entries(plan.calibrations).map(([role, frame]) => `${role}:${files.get(frame.name)!}`),
    ...ours.map(entry => `${entry.role}:${entry.path}`)];
  const { seconds } = runReduce(toolchain, directory, plan.frames.map(frame => files.get(frame.name)!), userCal);

  const product = await currentProduct(directory, stage);
  if (!product) throw new Error(`reduce left no ${PRODUCT_SUFFIX[stage]} product in ${directory}.`);
  const record = await writeProductRecord(resolve(directory, productRecordPath(product)), run,
    [{ path: product, file: resolve(directory, product),
      units: stage === 'flat' ? 'dimensionless (normalised to 1)' : stage === 'science' ? 'electrons' : 'ADU',
      conventions: stage === 'science'
        ? { extensions: 'one mosaicked SCI extension with its VAR and DQ, as DRAGONS writes a stacked GMOS image',
            registration: 'the frames were aligned on their own detected sources and resampled to a common world frame; the product carries that WCS' }
        : { extensions: 'one SCI, VAR and DQ extension per GMOS amplifier, as DRAGONS writes them',
            registration: 'each extension states the detector columns and rows it holds in its own DETSEC card' } }]);
  return { stage, ...(options.half ? { half: options.half } : {}), product, record, seconds };
}

/** The product a stage directory holds, if it holds exactly one. Two would mean a previous run was interrupted between
 * writing a product and being cleared, and picking one of them would be a guess. */
export async function currentProduct(directory: string, stage: Stage): Promise<string | null> {
  const names = await readdir(directory).catch(() => [] as string[]);
  const products = names.filter(name => name.endsWith(PRODUCT_SUFFIX[stage]));
  if (products.length > 1) throw new Error(`${directory} holds ${products.length} ${stage} products: ${products.join(', ')}.`);
  return products[0] ?? null;
}

/** Where a finished stage's product and its record are, for a reader that has the work directory and the plan. */
export const productPath = (work: string, stage: Stage, product: string, half?: Half) =>
  resolve(stageDirectory(work, stage, half), product);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const [id, work, stage] = positionalArguments(argv, ['--raw', '--half']);
  const half = flagValue(argv, '--half'), sources = flagValue(argv, '--raw');
  if (!id || !work || !stage || !(STAGES as readonly string[]).includes(stage))
    throw new TypeError(`Usage: reduce <program id> <work directory> <${STAGES.join('|')}> [--raw <dir>] [--half a|b]`);
  if (half !== undefined && !(HALVES as readonly string[]).includes(half)) throw new TypeError('--half is a or b.');
  const result = await reduceStage(await readGeminiProgram(id), resolve(work), stage as Stage,
    { ...(half ? { half: half as Half } : {}), ...(sources ? { sources: [resolve(sources)] } : {}) });
  console.log(result.seconds === 0
    ? `${result.stage}: ${result.product} was already made by this same run; it was kept.`
    : `${result.stage}: ${result.product} in ${result.seconds.toFixed(1)} s from ${result.record.inputs.length} pinned inputs.`);
}
