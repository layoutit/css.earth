#!/usr/bin/env node
/** Re-run the ESO NACO pipeline on a pinned program, from the raw frames.
 *
 *   node tools/objects/naco/reduce.mts <program id> <work directory> [--raw <dir>] [--template <tpl_start>]
 *
 * Three recipes, in the order the pipeline manual gives them: `naco_img_dark` over the associated darks, `naco_img_twflat`
 * over the twilight flats with those darks, and `naco_img_jitter` over the science frames with the master dark, the master
 * flat and the flat's bad-pixel map. Each runs in its own directory under the work directory with its set-of-frames and log
 * beside its products, through `runRecipe` from the interferometry modules — this route adds no runner of its own.
 *
 * `--template` reduces one object template of the pinned night — one jitter sequence as the telescope was commanded to take
 * it — with every sky frame of the night and the night's own master dark and flat. With no `--template` every object frame of
 * the night is reduced together. Two object templates reduced separately are what compare.mts reads: with no Phase 3 product
 * and no ESO master calibration for NACO, a second sequence of the same night on the same target is the only oracle this
 * route has.
 *
 * A memory ceiling is asked for on the recipe process (`ulimit -v`), so a run that would take the machine down is killed
 * instead: NACO frames can be cubes of tens of thousands of planes and the jitter recipe holds an image list. The shell
 * refuses that limit on macOS, where it binds nothing; the run records whether it was actually applied rather than claiming
 * a protection it does not have, and `memoryCeilingApplied` is false on this machine. */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireFiniteNumber, requireRecord } from '../../source-values.mts';
import { esoEnvironment, esoHeader, rawFrames, type EsoHeader, type SetOfFrames } from '../interferometry/eso-pipeline.mts';
import { digestFrames, readProgram, writeProgram, type NacoFrame, type NacoMode, type NacoProgram } from './archive.mts';
import { nacoToolchainPath } from './toolchain.mts';

/** Virtual memory a recipe may use, in KiB. A NACO jitter run over one 20-frame Ks template peaked at 0.73 GB, far below
 * this; the ceiling exists so a cube sequence that would not cannot take the machine with it. */
export const MEMORY_CEILING_KIB = 8 * 1024 * 1024;

/** Whether this platform's shell accepts `ulimit -v`. Linux does; macOS refuses it, and there the ceiling binds nothing.
 * Asked once, and recorded in every reduction, because a protection that is not in force must not be reported as one. */
export function memoryCeilingApplies() {
  const probe = spawnSync('/bin/sh', ['-c', `ulimit -v ${MEMORY_CEILING_KIB} 2>/dev/null && echo applied`], { encoding: 'utf8' });
  return probe.stdout.trim() === 'applied';
}

/** The one recipe default this route changes. `naco_img_twflat` ships with `--bpm=FALSE`, so it writes a master flat and no
 * bad-pixel map; `naco_img_jitter` reads a bad-pixel map as `MASTER_IMG_FLAT_BADPIX` and without one it masks nothing. The
 * map is asked for so the input the jitter recipe declares is actually given to it. Every run records the options it used. */
export const FLAT_OPTIONS = ['--bpm=TRUE'] as const;

/** Recipes the installed pipeline offers that this route has never run, and refuses rather than running blind. Each would
 * need a slice with something to check it against before it could be trusted, and none has one here:
 *
 * - `naco_img_lampflat` — a lamp flat instead of a twilight flat. The code path exists, because the Betelgeuse cube nights
 *   associate lamp flats and no twilight ones, but no night has been reduced through it and no receipt backs it.
 * - `naco_img_zpoint` — a photometric zero point. It needs a standard-star catalogue magnitude supplied by hand
 *   (`--mag`, `--ra`, `--dec`), so its answer would be as good as the number typed in, and nothing here checks that number.
 * - `naco_img_detlin` — detector linearity, from a dedicated lamp sequence no science night associates.
 * - `naco_img_strehl` — a Strehl ratio, which needs the star's true angular size to mean anything.
 * - `naco_spc_wavecal` — a wavelength solution from arc frames. Programme 088.C-0833(B) associates none on any night, so
 *   there is nothing to fit; the reduction records `arcs: false` rather than inventing a dispersion.
 * - `naco_img_slitpos`, `naco_img_checkfocus` and the three `naco_util_*` recipes — instrument housekeeping, not science. */
export const UNRUN_RECIPES: Readonly<Record<string, string>> = {
  naco_img_lampflat: 'no night has been reduced through the lamp-flat path and no receipt backs it',
  naco_img_zpoint: 'it needs a catalogue magnitude supplied by hand, and nothing here checks that number',
  naco_img_detlin: 'it needs a dedicated linearity sequence that no science night associates',
  naco_img_strehl: 'a Strehl ratio needs the star\'s true angular size to mean anything',
  naco_spc_wavecal: 'it needs arc frames, and the pinned nights associate none',
  naco_img_slitpos: 'instrument housekeeping, not science',
  naco_img_checkfocus: 'instrument housekeeping, not science',
};

/** Refuse a recipe this route has never run, naming why. */
export function requireRunnableRecipe(recipe: string) {
  const reason = UNRUN_RECIPES[recipe];
  if (reason) {
    throw new Error(`${recipe} is installed but this route has never run it: ${reason}. Reducing through it would produce a`
      + ' product nothing here can check, so it is refused; see docs/naco.md.');
  }
  return recipe;
}

/** One object template's frames, with every sky frame of the night kept.
 *
 * The sky frames are a template of their own and are subtracted rather than combined, so both reductions see the same sky:
 * what differs between them is only which object frames went in, which is the point of the comparison.
 *
 * A night may have none. `naco_img_jitter` looks its sky frames up and works without them, and in cube mode it finds a sky
 * within the cube itself: the Betelgeuse cube nights of 082.D-0172(A) took 28 object frames and no sky frame at all. What
 * went in is recorded, so a product combined without a separate sky says so. */
export function templateFrames(science: readonly NacoFrame[], template?: string) {
  const skies = science.filter(frame => frame.type === 'SKY');
  const objects = science.filter(frame => frame.type !== 'SKY' && (template === undefined || frame.template === template));
  if (!objects.length) {
    const known = [...new Set(science.filter(frame => frame.type !== 'SKY').map(frame => frame.template))].sort();
    throw new Error(`No object frames in template ${String(template)}; the night has ${known.join(' ')}.`);
  }
  return [...objects, ...skies].sort((a, b) => a.dpId.localeCompare(b.dpId));
}

export interface RecipeRun { readonly step: string; readonly recipe: string; readonly frames: SetOfFrames; readonly products: readonly { readonly category: string; readonly path: string }[] }

/** Run one recipe under the memory ceiling and return the FITS files it wrote, each with the PRO CATG its header states. */
async function runNacoRecipe(root: string, work: string, step: string, recipe: string, frames: SetOfFrames, options: readonly string[] = []) {
  const directory = resolve(work, step);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const home = resolve(work, 'home');
  await mkdir(home, { recursive: true });
  await writeFile(resolve(directory, 'in.sof'), `${frames.map(([file, tag]) => `${file} ${tag}`).join('\n')}\n`);
  const pipeline = esoEnvironment(resolve(root, 'pipeline'), home);
  // esorex is started through a shell only to ask for the ceiling; the argument vector is still passed as a vector, so no
  // path or recipe name is ever interpolated into a command line.
  const run = spawnSync('/bin/sh', ['-c', `ulimit -v ${MEMORY_CEILING_KIB} 2>/dev/null || true; exec "$0" "$@"`,
    resolve(root, 'pipeline/bin/esorex'), `--recipe-dir=${resolve(root, 'pipeline/lib/esopipes-plugins')}`, recipe, ...options, 'in.sof'],
    { cwd: directory, env: pipeline.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  await writeFile(resolve(directory, 'log.txt'), `${run.stdout}${run.stderr}`);
  if (run.status !== 0) throw new Error(`${recipe} failed for ${step}; see ${resolve(directory, 'log.txt')}.`);
  const products: { category: string; path: string }[] = [];
  for (const name of (await readdir(directory)).filter(file => file.endsWith('.fits')).sort()) {
    const path = resolve(directory, name), category = (await esoHeader(path))['ESO PRO CATG'];
    products.push({ category: typeof category === 'string' ? category : '', path });
  }
  return products;
}

/** The keywords that decide whether a calibration product applies to a set of frames, taken from the recipes' own grouping:
 * `NACO_PFITS_REGEXP_TWFLAT_DARK` for a dark (integration time, detector mode, read-out mode) and `NACO_PFITS_STRING_OPTI6`
 * for a flat (the filter, as an optical-element id). NACO states the filter as an element id, and the raw table's
 * `filter_path` is not the same spelling (`KS` against the header's `Ks`), so every match is made against the frames' own
 * headers, never against the table. */
export const DARK_KEYS = ['ESO DET DIT', 'ESO DET MODE NAME', 'ESO DET NCORRS NAME'] as const;
export const FLAT_KEYS = ['ESO INS OPTI6 ID'] as const;

/** The one product of a category, or, when the recipe wrote several, the one whose header agrees with the science frame.
 *
 * NACO's calibration recipes group their input by instrument setting and write one product per group: the Ceres night's six
 * darks are three of 2 s and three of 70 s, and `naco_img_dark` wrote a master dark for each. The product is chosen by the
 * keywords that decide it, never by taking the first or by assuming there is one. */
async function pick(products: readonly { category: string; path: string }[], category: string, step: string,
  reference?: { readonly header: EsoHeader; readonly keys: readonly string[] }) {
  const candidates = products.filter(product => product.category === category);
  if (!candidates.length) throw new Error(`${step} wrote no ${category} product.`);
  if (candidates.length === 1) return candidates[0]!.path;
  if (!reference) throw new Error(`${step} wrote ${candidates.length} ${category} products and nothing chooses between them.`);
  const wanted = reference.keys.map(key => {
    const value = reference.header[key];
    if (value === undefined) throw new Error(`The science frame states no ${key}, so no ${category} can be matched on it.`);
    return [key, value] as const;
  });
  const matching: string[] = [], seen: string[] = [];
  for (const candidate of candidates) {
    const header = await esoHeader(candidate.path);
    seen.push(wanted.map(([key]) => `${key}=${String(header[key])}`).join(' '));
    if (wanted.every(([key, value]) => agrees(header[key], value))) matching.push(candidate.path);
  }
  if (matching.length !== 1) {
    throw new Error(`${step} wrote ${candidates.length} ${category} products and ${matching.length} match `
      + `${wanted.map(([key, value]) => `${key}=${String(value)}`).join(' ')}; they are ${seen.join('; ')}.`);
  }
  return matching[0]!;
}

/** Two header values of one keyword: numbers to within single precision, everything else as written. */
function agrees(product: EsoHeader[string] | undefined, science: EsoHeader[string]) {
  if (product === undefined) return false;
  if (typeof product === 'number' && typeof science === 'number') return Math.abs(product - science) <= 1e-6 * Math.max(1, Math.abs(science));
  return String(product) === String(science);
}

/** Nodded spectroscopy: `naco_spc_lampflat` over the spectroscopic flats, then `naco_spc_combine` over the nods with that
 * flat. The recipe pairs the i'th A frame with the i'th B frame, so a set must hold as many of one as of the other.
 *
 * `naco_spc_wavecal` is not run, and cannot be for programme 088.C-0833(B): the archive associates no arc frames with any of
 * its nights (`arcs` is false on the pinned program). Without an arc the recipe has nothing to fit, and this route does not
 * invent a dispersion. `naco_spc_combine` still writes its products; what it does not give is a checked wavelength scale.
 *
 * `selection` takes a subset of the nods, by index into the template's own time order, so two disjoint halves of one nod set
 * can be reduced separately. A nod set of one night is one template, so unlike the imaging route there is no second template
 * to compare against; disjoint halves of the pairs are what there is. */
export const SPECTROSCOPY_FLAT_RECIPE = 'naco_spc_lampflat';
export const SPECTROSCOPY_COMBINE_RECIPE = 'naco_spc_combine';

/** The A and B sides of a nod set. The raw table does not say which side a frame is on, so the frame's own cumulative offset
 * does — about the mean, so a set that is not centred on zero still splits.
 *
 * Which axis carries the nod is not fixed. The Europa nods of 088.C-0833(B) run along X (`ESO SEQ CUMOFFSETX` alternates
 * +182, -208, -208, +182 … , an ABBA pattern) while `CUMOFFSETY` is zero in every frame, so the axis is chosen as the one
 * that actually varies rather than assumed. */
export function nodAxis(x: readonly number[], y: readonly number[]) {
  const spread = (values: readonly number[]) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  return spread(x) >= spread(y) ? { axis: 'x' as const, offsets: x } : { axis: 'y' as const, offsets: y };
}

export function nodSides(offsets: readonly number[]) {
  const middle = offsets.reduce((total, value) => total + value, 0) / offsets.length;
  const a = offsets.flatMap((value, index) => value > middle ? [index] : []);
  const b = offsets.flatMap((value, index) => value <= middle ? [index] : []);
  return { a, b };
}

export interface ReductionResult {
  readonly program: string;
  readonly mode: NacoMode;
  /** The object template reduced, the nod half ('a-half'/'b-half'), or 'all'. */
  readonly template: string;
  /** The product this route compares: COADDED_IMG for imaging, SPC_NOD_COMBINED for spectroscopy. */
  readonly combined: string;
  /** Imaging only. */
  readonly masterDark?: string;
  /** Imaging only: the master dark the flat recipe subtracted, at the flats' integration time, not the science frames'. */
  readonly flatDark?: string;
  readonly masterFlat?: string;
  readonly badPixels?: string;
  /** Spectroscopy only: the nod-subtracted frame, and the reduced telluric standard when the night has one. */
  readonly subtracted?: string;
  readonly standardCombined?: string;
  /** Spectroscopy only: whether the archive associates arcs with this night. False means no wavelength calibration is run. */
  readonly arcs?: boolean;
  readonly objectFrames: number;
  readonly skyFrames: number;
  /** The virtual-memory ceiling asked for, and whether the shell accepted it. False on macOS, where it binds nothing. */
  readonly memoryCeilingKib: number;
  readonly memoryCeilingApplied: boolean;
  readonly runs: readonly { readonly step: string; readonly recipe: string; readonly inputs: number; readonly options: readonly string[] }[];
}

/** Download what the program pins and reduce it the way its mode is reduced. */
export async function reduceProgram(program: NacoProgram, work: string, rawDirectory: string, template?: string): Promise<ReductionResult> {
  if (program.mode === 'spectroscopy') return reduceSpectroscopy(program, work, rawDirectory, template);
  return reduceImaging(program, work, rawDirectory, template);
}

/** Download what the program pins, run the three imaging recipes, and write a reduction record beside the work. */
export async function reduceImaging(program: NacoProgram, work: string, rawDirectory: string, template?: string): Promise<ReductionResult> {
  const root = await nacoToolchainPath();
  const ceiling = memoryCeilingApplies();
  const science = templateFrames(program.science, template);
  const darks = program.calibration.filter(frame => frame.tag === 'CAL_DARK');
  const flats = program.calibration.filter(frame => frame.tag === 'CAL_FLAT_TW' || frame.tag === 'CAL_FLAT_LAMP');
  if (!flats.length) throw new Error(`${program.program} pins no flat frames; the jitter recipe needs a master flat.`);
  // A dark is optional. `naco_img_jitter` looks its dark up with irplib_frameset_find_file and works without one, and
  // `naco_img_lampflat` differences lamp-on against lamp-off and never wants one. The Betelgeuse cube night of 2009-01-04 is
  // the case that matters: the archive associates a lamp flat with it and no dark at all, so a route that demanded a dark
  // could not reduce it. What is reduced is recorded, so a product made without a dark says so.
  await rawFrames([...science, ...darks, ...flats].map(frame => frame.dpId), rawDirectory);
  const path = (frame: NacoFrame) => resolve(rawDirectory, `${frame.dpId}.fits`);
  const label = template ?? 'all', suffix = template ? `-${template.replaceAll(':', '')}` : '-all';
  const runs: { step: string; recipe: string; inputs: number; options: readonly string[] }[] = [];

  // Every frame of one jitter sequence is one setup, and the first frame's header stands for all of them.
  if (science.some(frame => Math.abs(frame.dit - science[0]!.dit) > 1e-6)) throw new Error('The science frames do not share one integration time.');
  if (science.some(frame => frame.filter !== science[0]!.filter)) throw new Error('The science frames do not share one filter.');
  const setup = await esoHeader(path(science[0]!));
  if (flats.some(frame => frame.tag !== flats[0]!.tag)) throw new Error('The pinned flats are of more than one kind.');
  const flatRecipe = requireRunnableRecipe(flats[0]!.tag === 'CAL_FLAT_LAMP' ? 'naco_img_lampflat' : 'naco_img_twflat');

  let masterDark: string | undefined, flatDark: string | undefined, darkProducts: { category: string; path: string }[] = [];
  if (darks.length) {
    const darkFrames: SetOfFrames = darks.map(frame => [path(frame), frame.tag] as const);
    darkProducts = await runNacoRecipe(root, work, 'dark', 'naco_img_dark', darkFrames);
    runs.push({ step: 'dark', recipe: 'naco_img_dark', inputs: darkFrames.length, options: [] });
    masterDark = await pick(darkProducts, 'NACO_IMG_DARK_AVG', 'naco_img_dark', { header: setup, keys: DARK_KEYS });
  }

  // The twilight-flat recipe takes no dark, one dark, or one per flat — never a handful. It is given the master dark of the
  // flats' own setting, which is what a master dark is for; the Ceres twilight flats are 70 s where the science frames are
  // 2 s. The lamp-flat recipe reads no dark at all.
  const flatFrames: (readonly [string, string])[] = flats.map(frame => [path(frame), frame.tag] as const);
  if (flatRecipe === 'naco_img_twflat' && darkProducts.length) {
    const flatSetup = await esoHeader(path(flats[0]!));
    flatDark = await pick(darkProducts, 'NACO_IMG_DARK_AVG', 'naco_img_dark', { header: flatSetup, keys: DARK_KEYS });
    flatFrames.push([flatDark, 'CAL_DARK']);
  }
  const flatProducts = await runNacoRecipe(root, work, 'flat', flatRecipe, flatFrames, FLAT_OPTIONS);
  runs.push({ step: 'flat', recipe: flatRecipe, inputs: flatFrames.length, options: FLAT_OPTIONS });
  const masterFlat = await pick(flatProducts, 'MASTER_IMG_FLAT', flatRecipe, { header: setup, keys: FLAT_KEYS });
  const badPixels = flatProducts.some(product => product.category === 'MASTER_IMG_FLAT_BADPIX')
    ? await pick(flatProducts, 'MASTER_IMG_FLAT_BADPIX', flatRecipe, { header: setup, keys: FLAT_KEYS }) : undefined;

  const jitterFrames: SetOfFrames = [...science.map(frame => [path(frame), frame.tag] as const),
    ...(masterDark ? [[masterDark, 'NACO_IMG_DARK_AVG'] as const] : []),
    [masterFlat, 'MASTER_IMG_FLAT'],
    ...(badPixels ? [[badPixels, 'MASTER_IMG_FLAT_BADPIX'] as const] : [])];
  const jitterProducts = await runNacoRecipe(root, work, `jitter${suffix}`, 'naco_img_jitter', jitterFrames);
  runs.push({ step: `jitter${suffix}`, recipe: 'naco_img_jitter', inputs: jitterFrames.length, options: [] });
  const combined = await pick(jitterProducts, 'COADDED_IMG', 'naco_img_jitter');

  const result: ReductionResult = {
    program: program.program, mode: 'imaging', template: label, combined, masterDark, flatDark, masterFlat, badPixels,
    objectFrames: science.filter(frame => frame.type !== 'SKY').length, skyFrames: science.filter(frame => frame.type === 'SKY').length,
    memoryCeilingKib: MEMORY_CEILING_KIB, memoryCeilingApplied: ceiling, runs,
  };
  await writeFile(resolve(work, `reduced${suffix}.json`), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** Reduce one nodded-spectroscopy night: the spectroscopic flats into a master flat, then the nods into a combined and a
 * nod-subtracted frame, and the telluric standard through the same recipe so a point source is reduced beside the target.
 *
 * `half` takes the first or second half of the nod pairs, keeping the A and B sides balanced; the two halves share no
 * exposure and are what compare.mts reads. A nod set of one night is a single template, so unlike the imaging route there is
 * no second template to compare against. */
export async function reduceSpectroscopy(program: NacoProgram, work: string, rawDirectory: string, half?: string): Promise<ReductionResult> {
  const root = await nacoToolchainPath();
  const ceiling = memoryCeilingApplies();
  const nods = program.science.filter(frame => frame.tag === 'SPEC_NODDING').sort((a, b) => a.dpId.localeCompare(b.dpId));
  if (!nods.length) throw new Error(`${program.program} pins no SPEC_NODDING frames.`);
  const flats = program.calibration.filter(frame => frame.tag === 'CAL_FLAT_SPEC');
  if (!flats.length) throw new Error(`${program.program} pins no CAL_FLAT_SPEC frames; naco_spc_lampflat has nothing to reduce.`);
  await rawFrames([...nods, ...flats, ...program.standard].map(frame => frame.dpId), rawDirectory);
  const path = (frame: NacoFrame) => resolve(rawDirectory, `${frame.dpId}.fits`);
  const runs: { step: string; recipe: string; inputs: number; options: readonly string[] }[] = [];

  const flatFrames: SetOfFrames = flats.map(frame => [path(frame), frame.tag] as const);
  const flatProducts = await runNacoRecipe(root, work, 'spcflat', SPECTROSCOPY_FLAT_RECIPE, flatFrames);
  runs.push({ step: 'spcflat', recipe: SPECTROSCOPY_FLAT_RECIPE, inputs: flatFrames.length, options: [] });
  const masterFlat = await pick(flatProducts, 'MASTER_SPC_FLAT', SPECTROSCOPY_FLAT_RECIPE);

  const chosen = await nodHalf(nods, path, half);
  const label = half ?? 'all', suffix = half ? `-${half}` : '-all';
  const nodFrames: SetOfFrames = [...chosen.map(frame => [path(frame), 'SPEC_NODDING'] as const), [masterFlat, 'MASTER_SPC_FLAT']];
  const products = await runNacoRecipe(root, work, `nod${suffix}`, SPECTROSCOPY_COMBINE_RECIPE, nodFrames);
  runs.push({ step: `nod${suffix}`, recipe: SPECTROSCOPY_COMBINE_RECIPE, inputs: nodFrames.length, options: [] });
  const combined = await pick(products, 'SPC_NOD_COMBINED', SPECTROSCOPY_COMBINE_RECIPE);
  // The nod-subtracted frame is an intermediate the recipe writes only with --save; it is kept when it is there.
  const subtracted = products.some(product => product.category === 'SPC_NOD_SUBTRACTED')
    ? await pick(products, 'SPC_NOD_SUBTRACTED', SPECTROSCOPY_COMBINE_RECIPE) : undefined;

  // The telluric standard is reduced only for the whole nod set: it is a reference, not a thing to halve.
  let standardCombined: string | undefined;
  if (program.standard.length && !half) {
    const standardFrames: SetOfFrames = [...program.standard.map(frame => [path(frame), 'SPEC_NODDING'] as const), [masterFlat, 'MASTER_SPC_FLAT']];
    const standardProducts = await runNacoRecipe(root, work, 'standard', SPECTROSCOPY_COMBINE_RECIPE, standardFrames);
    runs.push({ step: 'standard', recipe: SPECTROSCOPY_COMBINE_RECIPE, inputs: standardFrames.length, options: [] });
    standardCombined = await pick(standardProducts, 'SPC_NOD_COMBINED', SPECTROSCOPY_COMBINE_RECIPE);
  }

  const result: ReductionResult = {
    program: program.program, mode: 'spectroscopy', template: label, combined, masterFlat, subtracted, standardCombined,
    arcs: program.arcs, objectFrames: chosen.length, skyFrames: 0,
    memoryCeilingKib: MEMORY_CEILING_KIB, memoryCeilingApplied: ceiling, runs,
  };
  await writeFile(resolve(work, `reduced${suffix}.json`), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** Half a nod set, balanced across the two nod positions. The recipe pairs the i'th A frame with the i'th B frame, so a half
 * that took the first six frames in time would hand it three A frames and three B frames only if the sequence alternates —
 * which it need not. The side of each frame comes from its own cumulative offset along the slit. */
export async function nodHalf(nods: readonly NacoFrame[], path: (frame: NacoFrame) => string, half?: string) {
  if (!half) return nods;
  if (half !== 'a-half' && half !== 'b-half') throw new TypeError(`--half takes a-half or b-half, not ${half}.`);
  const x: number[] = [], y: number[] = [];
  for (const frame of nods) {
    const header = await esoHeader(path(frame));
    const along = header['ESO SEQ CUMOFFSETX'], across = header['ESO SEQ CUMOFFSETY'];
    if (typeof along !== 'number' || typeof across !== 'number') throw new Error(`${frame.dpId} states no cumulative offset.`);
    x.push(along); y.push(across);
  }
  const { a, b } = nodSides(nodAxis(x, y).offsets);
  if (a.length !== b.length) throw new Error(`The nod set has ${a.length} frames on one side and ${b.length} on the other; the recipe pairs them one for one.`);
  if (a.length < 2) throw new Error(`A half of ${a.length} nod pairs is too few to reduce.`);
  const take = (indices: readonly number[]) => half === 'a-half' ? indices.slice(0, Math.floor(indices.length / 2)) : indices.slice(Math.floor(indices.length / 2));
  const chosen = new Set([...take(a), ...take(b)]);
  return nods.filter((_, index) => chosen.has(index));
}

/** A reduction record written by a previous run, checked rather than asserted. */
export function readReduction(value: unknown, label: string): ReductionResult {
  const record = requireRecord(value, label);
  const runs = Array.isArray(record.runs) ? record.runs : [];
  const text = (name: string) => { const field = record[name]; if (typeof field !== 'string') throw new TypeError(`${label} states no ${name}.`); return field; };
  const optional = (name: string) => { const field = record[name]; return typeof field === 'string' ? field : undefined; };
  const mode = text('mode');
  if (mode !== 'imaging' && mode !== 'spectroscopy') throw new TypeError(`${label} states mode ${mode}.`);
  return { program: text('program'), mode, template: text('template'), combined: text('combined'),
    masterDark: optional('masterDark'), flatDark: optional('flatDark'), masterFlat: optional('masterFlat'),
    badPixels: optional('badPixels'), subtracted: optional('subtracted'), standardCombined: optional('standardCombined'),
    ...(record.arcs === undefined ? {} : { arcs: record.arcs === true }),
    objectFrames: requireFiniteNumber(record.objectFrames, 'objectFrames'),
    skyFrames: requireFiniteNumber(record.skyFrames, 'skyFrames'),
    memoryCeilingKib: requireFiniteNumber(record.memoryCeilingKib, 'memoryCeilingKib'),
    memoryCeilingApplied: record.memoryCeilingApplied === true,
    runs: runs.map(item => { const run = requireRecord(item, 'run');
      return { step: String(run.step), recipe: String(run.recipe), inputs: requireFiniteNumber(run.inputs, 'inputs'),
        options: (Array.isArray(run.options) ? run.options : []).map(value => String(value)) }; }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, work, ...rest] = process.argv.slice(2);
  if (!id || !work) throw new TypeError('Usage: reduce <program id> <work directory> [--raw <dir>] [--template <tpl_start>|--half a-half|b-half]');
  const rawIndex = rest.indexOf('--raw'), templateIndex = rest.indexOf('--template'), halfIndex = rest.indexOf('--half');
  const directory = resolve(work), raw = resolve(rawIndex < 0 ? resolve(directory, 'raw') : rest[rawIndex + 1]!);
  const program = await readProgram(id);
  const selection = templateIndex >= 0 ? rest[templateIndex + 1] : halfIndex >= 0 ? rest[halfIndex + 1] : undefined;
  const result = await reduceProgram(program, directory, raw, selection);
  await writeProgram(await digestFrames(program, raw));
  console.log(`${result.combined}: ${result.objectFrames} object and ${result.skyFrames} sky frames through ${result.runs.length} recipes.`);
}
