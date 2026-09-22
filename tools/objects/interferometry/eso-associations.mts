/** Reduction driven by the ESO archive's calibration association tree, for instruments whose calibration chain is too deep to
 * plan by hand (GRAVITY, MATISSE).
 *
 * For a raw science frame the archive's calselector service returns the tree ESO's own processing uses: the science
 * association (its exposures and skies), and beneath it every calibration it needs, each an association with its own frames and
 * calibrations (a P2VM needs a dark, a kappa matrix needs a flat and a shift map...). The categories of the files are the tags
 * the esorex recipes read. An instrument table here says which recipe reduces each association category, which of its
 * children it reads, as their raw files or as their products, and which header keywords choose between alternatives (a dark
 * with the science frame's integration time, a sky with the same beam commutation). The tree is reduced from the bottom, each
 * association once, and the science and calibrator exposures are combined by the instrument's calibration recipe.
 *
 * Only frames the trees name are used. One science exposure is reduced with, by default, the calibrator exposure in its tree
 * that shares its instrument setup and is nearest in time. Authors often choose other calibrator exposures of the night (the
 * R Car GRAVITY file used four later ones); each named calibrator exposure is then reduced through its own tree, and the
 * calibration recipe interpolates between them. */
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { archiveHeader, esoEnvironment, esoHeader, frameTime, rawFrame, runRecipe, type EsoHeader, type EsoPipeline } from './eso-pipeline.mts';
import { requireFiniteNumber, requireRecord } from '../../sources/source-values.mts';
import { toolchainDescriptor, toolchainPath } from './toolchain.mts';

export interface AssociationFile { readonly category: string; readonly name: string }
export interface Association {
  readonly category: string;
  readonly files: readonly AssociationFile[];
  readonly children: readonly Association[];
  readonly messages: readonly string[];
}

const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([a-zA-Z_]+)="([^"]*)"/gu)]
  .map(([, name, value]) => [name!, value!.replace(/&(amp|lt|gt|quot|apos);/gu, (_, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]!)]));

/** The calselector's XML (mode Raw2Raw) as a tree. */
export function parseAssociationTree(xml: string): Association {
  interface Building { category: string; files: AssociationFile[]; children: Association[]; messages: string[] }
  const stack: Building[] = [];
  let root: Association | undefined;
  for (const [tag] of xml.matchAll(/<\/?(?:association|file|message)\b[^>]*>/gu)) {
    if (tag.startsWith('</association')) {
      const done = stack.pop();
      if (!done) throw new TypeError('The association tree closes an association it never opened.');
      if (stack.length) stack.at(-1)!.children.push(done); else root = done;
    } else if (tag.startsWith('<association')) {
      const { category } = attributes(tag);
      if (!category) throw new TypeError('An association has no category.');
      const node: Building = { category, files: [], children: [], messages: [] };
      if (tag.endsWith('/>')) { if (stack.length) stack.at(-1)!.children.push(node); else root = node; } else stack.push(node);
    } else if (tag.startsWith('<file')) {
      const { category, name } = attributes(tag);
      if (!category || !name || !stack.length) throw new TypeError('A file in the association tree has no category, name or association.');
      stack.at(-1)!.files.push({ category, name });
    } else if (tag.startsWith('<message') && stack.length) stack.at(-1)!.messages.push(attributes(tag).text ?? '');
  }
  if (!root || stack.length) throw new TypeError('The association tree is incomplete.');
  return root;
}

const exists = (path: string) => access(path).then(() => true, () => false);

/** The association tree of a raw science frame, kept beside the reduction and read from there when present. */
export async function associationTree(dpId: string, directory: string) {
  const path = resolve(directory, `${dpId}.associations.xml`);
  if (!await exists(path)) {
    const response = await fetch(`https://archive.eso.org/calselector/v1/associations?dp_id=${encodeURIComponent(dpId)}&mode=Raw2Raw`);
    if (!response.ok) throw new Error(`${dpId}: the ESO calselector answered ${response.status}.`);
    await mkdir(directory, { recursive: true });
    await writeFile(path, await response.text());
  }
  return parseAssociationTree(await readFile(path, 'utf8'));
}

/** How one association category is reduced. */
export interface AssociationStep {
  readonly recipe: string;
  readonly options?: readonly string[];
  /** The file category of the association's own exposure, when it has one: only the chosen exposure is passed. */
  readonly exposure?: string;
  /** Children read: 'raw' passes their files with their own categories, a list passes those product categories of their reduction. */
  readonly inputs: Readonly<Record<string, 'raw' | readonly string[]>>;
  /** Raw children taken from the nearest ancestor that has them, for recipes that need a file the archive lists only above. */
  readonly inherited?: readonly string[];
  /** File or child categories that must match the exposure on these header keywords; the match nearest in time is used. */
  readonly matched?: Readonly<Record<string, readonly string[]>>;
  /** Static files from the kit's calibration directory, by tag and file-name pattern. */
  readonly kitFrames?: Readonly<Record<string, RegExp>>;
  /** Product categories kept; every other file the recipe writes is deleted (MATISSE writes gigabytes of intermediates). */
  readonly products: readonly string[];
}

export interface InstrumentReduction {
  readonly toolchain: string;
  readonly steps: Readonly<Record<string, AssociationStep>>;
  /** The calibrator association under the science one, and the keywords its exposure must share with the science exposure. */
  readonly calibrator: { readonly association: string; readonly keys: readonly string[] };
  /** Raw categories each read by one step only, deleted once that step's products exist (a MATISSE exposure is 1.7 GB). */
  readonly discardRaw?: readonly string[];
  /** The recipe that calibrates the science products with the calibrator products. */
  readonly calibrate: {
    readonly recipe: string; readonly options?: readonly string[];
    readonly science: string; readonly calibrator: string;
    readonly raw?: readonly string[];
    readonly product: string; readonly file?: RegExp;
  };
}

export interface Product { readonly category: string; readonly path: string }
export type Frames = readonly (readonly [string, string])[];

/** What a reduction reads and runs: archive headers, downloaded frames, kit files and recipes. Tests plan against recorded headers. */
export interface ReductionIo {
  header(name: string): Promise<EsoHeader>;
  frame(name: string): Promise<string>;
  kitFrame(pattern: RegExp): Promise<string>;
  run(step: string, recipe: string, frames: Frames, options: readonly string[], categories: readonly string[]): Promise<Product[]>;
}
export interface ReductionRecord {
  readonly science: string; readonly calibrators: readonly string[]; readonly calibrated: string;
  readonly steps: readonly { readonly step: string; readonly recipe: string; readonly frames: Frames }[];
}

const isRaw = (name: string) => !name.startsWith('M.');
const groupBy = <T,>(items: readonly T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...groups.get(key(item)) ?? [], item]);
  return groups;
};
const stepName = (category: string, exposure: string | undefined, files: readonly AssociationFile[]) =>
  `${category.toLowerCase()}-${(exposure ?? files[0]?.name ?? 'none').replace(/^[A-Z]+\./u, '')}`;

/** Reduce the science frame dpId through its association tree; returns the calibrated file and what was run. */
export async function reduceAssociation(reduction: InstrumentReduction, tree: Association, dpId: string, io: ReductionIo,
  chosenCalibrators: readonly { readonly tree: Association; readonly dpId: string }[] = []): Promise<ReductionRecord> {
  const memo = new Map<string, Promise<Product[]>>(), steps: { step: string; recipe: string; frames: Frames }[] = [];
  const header = (name: string) => io.header(name);
  const agree = async (candidate: string, reference: EsoHeader, keys: readonly string[]) => {
    const other = await header(candidate);
    return keys.every(key => { if (!(key in reference) || !(key in other)) throw new Error(`${candidate}: no ${key} to match.`); return other[key] === reference[key]; });
  };
  /** The candidate matching the reference on the keys, nearest in time to it. */
  const nearestMatch = async <T,>(candidates: readonly T[], name: (candidate: T) => string, reference: { name: string; header: EsoHeader }, keys: readonly string[], what: string) => {
    const matching: T[] = [];
    for (const candidate of candidates) if (await agree(name(candidate), reference.header, keys)) matching.push(candidate);
    const time = frameTime(reference.name);
    const chosen = matching.sort((a, b) => Math.abs(frameTime(name(a)) - time) - Math.abs(frameTime(name(b)) - time))[0];
    if (!chosen) throw new Error(`No ${what} matches ${reference.name} on ${keys.join(', ')}.`);
    return chosen;
  };

  const reduce = (node: Association, exposure: string | undefined, ancestors: readonly Association[]): Promise<Product[]> => {
    const key = `${node.category}:${exposure ?? ''}:${node.files.map(file => file.name).sort().join(',')}`;
    if (!memo.has(key)) memo.set(key, run(node, exposure, ancestors));
    return memo.get(key)!;
  };

  const run = async (node: Association, exposure: string | undefined, ancestors: readonly Association[]) => {
    const step = reduction.steps[node.category];
    if (!step) throw new Error(`No reduction step for ${node.category} associations.`);
    if (step.exposure && !exposure) throw new Error(`${node.category} needs an exposure.`);
    const reference = exposure ? { name: exposure, header: await header(exposure) } : undefined;
    const matchedKeys = (category: string) => {
      const keys = step.matched?.[category];
      if (keys && !reference) throw new Error(`${node.category} matches ${category} without an exposure.`);
      return keys;
    };

    // Raw files: the association's own, raw children's and inherited ones, each name once.
    const rawFiles = new Map<string, AssociationFile>();
    for (const file of node.files) if (file.category !== step.exposure || file.name === exposure) rawFiles.set(file.name, file);
    for (const child of node.children) if (step.inputs[child.category] === 'raw') for (const file of child.files) rawFiles.set(file.name, file);
    for (const category of step.inherited ?? []) {
      const source = ancestors.toReversed().find(ancestor => ancestor.children.some(child => child.category === category));
      if (!source) throw new Error(`${node.category}: no ancestor lists ${category}.`);
      for (const child of source.children) if (child.category === category) for (const file of child.files) rawFiles.set(file.name, file);
    }
    if (step.exposure && ![...rawFiles.values()].some(file => file.category === step.exposure)) throw new Error(`${exposure} is not a ${step.exposure} of this ${node.category} association.`);
    const frames: (readonly [string, string])[] = [];
    const byCategory = groupBy([...rawFiles.values()], file => file.category);
    for (const [category, files] of byCategory) {
      const keys = matchedKeys(category);
      const chosen = keys && reference ? [await nearestMatch(files, file => file.name, reference, keys, category)] : files;
      for (const file of chosen) frames.push([await io.frame(file.name), category]);
    }

    // Reduced children.
    const reducedChildren = groupBy(node.children.filter(child => Array.isArray(step.inputs[child.category])), child => child.category);
    for (const [category, candidates] of reducedChildren) {
      const distinct = [...new Map(candidates.map(child => [child.files.map(file => file.name).sort().join(','), child])).values()];
      const keys = matchedKeys(category);
      let chosen: Association;
      if (keys && reference) chosen = await nearestMatch(distinct, child => child.files.find(file => isRaw(file.name))!.name, reference, keys, category);
      else if (distinct.length === 1) chosen = distinct[0]!;
      else throw new Error(`${node.category}: ${distinct.length} ${category} associations and no keywords to choose one.`);
      const wanted = step.inputs[category] as readonly string[];
      const products = (await reduce(chosen, undefined, [...ancestors, node])).filter(product => wanted.includes(product.category));
      for (const wantedCategory of wanted) if (!products.some(product => product.category === wantedCategory)) throw new Error(`${category} reduction wrote no ${wantedCategory}.`);
      frames.push(...products.map(product => [product.path, product.category] as const));
    }

    for (const [tag, pattern] of Object.entries(step.kitFrames ?? {})) frames.push([await io.kitFrame(pattern), tag]);

    const name = stepName(node.category, exposure, node.files);
    steps.push({ step: name, recipe: step.recipe, frames });
    return io.run(name, step.recipe, frames, step.options ?? [], step.products);
  };

  const scienceProducts = await reduce(tree, dpId, []);
  const science = { name: dpId, header: await header(dpId) };
  const calibratorExposure = (association: Association) => association.files.filter(file => file.category === reduction.steps[association.category]?.exposure);
  const calibrators: { name: string; products: Product[] }[] = [];
  if (chosenCalibrators.length) for (const chosen of chosenCalibrators) {
    if (chosen.tree.category !== reduction.calibrator.association) throw new Error(`${chosen.dpId} heads a ${chosen.tree.category} association, not ${reduction.calibrator.association}.`);
    if (!calibratorExposure(chosen.tree).some(file => file.name === chosen.dpId)) throw new Error(`${chosen.dpId} is not an exposure of its own association.`);
    await nearestMatch([chosen.dpId], name => name, science, reduction.calibrator.keys, 'calibrator exposure');
    calibrators.push({ name: chosen.dpId, products: await reduce(chosen.tree, chosen.dpId, []) });
  } else {
    const candidates = tree.children.filter(child => child.category === reduction.calibrator.association).flatMap(child => calibratorExposure(child).map(file => ({ child, name: file.name })));
    const nearest = await nearestMatch(candidates, candidate => candidate.name, science, reduction.calibrator.keys, 'calibrator exposure');
    calibrators.push({ name: nearest.name, products: await reduce(nearest.child, nearest.name, [tree]) });
  }

  const { calibrate } = reduction;
  const pick = (products: readonly Product[], category: string) => {
    const matches = products.filter(product => product.category === category);
    if (matches.length !== 1) throw new Error(`${matches.length} ${category} products where one was expected.`);
    return [matches[0]!.path, category] as const;
  };
  const frames: (readonly [string, string])[] = [pick(scienceProducts, calibrate.science), ...calibrators.map(calibrator => pick(calibrator.products, calibrate.calibrator))];
  for (const category of calibrate.raw ?? []) for (const child of tree.children) if (child.category === category) for (const file of child.files) frames.push([await io.frame(file.name), file.category]);
  const name = stepName('calibrate', dpId, []);
  steps.push({ step: name, recipe: calibrate.recipe, frames });
  const outputs = await io.run(name, calibrate.recipe, frames, calibrate.options ?? [], [calibrate.product]);
  const calibrated = outputs.filter(product => !calibrate.file || calibrate.file.test(product.path));
  if (calibrated.length !== 1) throw new Error(`${calibrated.length} ${calibrate.product} files where one was expected.`);
  return { science: dpId, calibrators: calibrators.map(calibrator => calibrator.name), calibrated: calibrated[0]!.path, steps };
}

/** Run a recipe unless the step directory already records a run with the same recipe, options and input files, each file
 * identified by path, size and modification time so a rerun upstream step invalidates what read its products. An archive frame
 * in the raw directory is identified by its name, which fixes its content: it is downloaded only when the step must run, and a
 * discarded one is not fetched again for a step already done. The recipe's
 * products in the kept categories are returned; everything else it wrote is deleted. */
async function runStep(pipeline: EsoPipeline, work: string, name: string, recipe: string, frames: Frames, options: readonly string[], categories: readonly string[],
  raw: { readonly directory: string; readonly discard: readonly string[] }) {
  const archiveId = (path: string) => archiveFrameId(path, raw.directory);
  const record = resolve(work, name, 'products.json'), inputs = JSON.stringify({ recipe, options, files: await stepFiles(frames, raw.directory), categories });
  if (await exists(record)) {
    const previous = JSON.parse(await readFile(record, 'utf8')) as unknown;
    if (typeof previous === 'object' && previous && 'inputs' in previous && 'products' in previous && previous.inputs === inputs && Array.isArray(previous.products)
      && previous.products.every(product => typeof product?.category === 'string' && typeof product?.path === 'string')) {
      const products = previous.products as Product[];
      if ((await Promise.all(products.map(product => exists(product.path)))).every(Boolean)) return products;
    }
  }
  for (const [path] of frames) { const id = archiveId(path); if (id) await rawFrame(id, raw.directory); }
  const kept: Product[] = [];
  for (const path of await runRecipe(pipeline, work, name, recipe, frames, options)) {
    const category = (await esoHeader(path))['ESO PRO CATG'];
    if (typeof category === 'string' && categories.includes(category)) kept.push({ category, path });
    else await rm(path);
  }
  await writeFile(record, JSON.stringify({ inputs, products: kept }, null, 2) + '\n');
  for (const [path, tag] of frames) if (archiveId(path) && raw.discard.includes(tag)) await rm(path, { force: true });
  return kept;
}

const ARCHIVE_FRAME = /^((?:M\.)?[A-Z]+\.\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3})\.fits$/u;

/** The archive id of a frame directly in the raw directory, or undefined for any other file. */
export function archiveFrameId(path: string, rawDirectory: string) {
  if (!path.startsWith(`${rawDirectory}/`)) return undefined;
  return ARCHIVE_FRAME.exec(path.slice(rawDirectory.length + 1))?.[1];
}

/** How a step's inputs are identified for reuse: archive frames by name, everything else by size and modification time. */
export async function stepFiles(frames: Frames, rawDirectory: string) {
  return Promise.all(frames.map(async ([path, tag]) => {
    if (archiveFrameId(path, rawDirectory)) return [path, tag, 'archive'] as const;
    const { size, mtimeMs } = await stat(path); return [path, tag, size, mtimeMs] as const;
  }));
}

/** Calibrate one science frame with an installed toolchain: fetch the tree, reduce it, and write calibrated.json beside the work. */
export async function calibrateFromAssociations(reduction: InstrumentReduction, dpId: string, work: string, rawDirectory: string, calibratorIds: readonly string[] = []) {
  const root = await toolchainPath(reduction.toolchain);
  const calibrationRoot = resolve(root, 'calib/share/esopipes/datastatic');
  const kits = (await readdir(calibrationRoot)).filter(name => name.startsWith(`${reduction.toolchain}-`));
  if (kits.length !== 1) throw new Error(`${kits.length} ${reduction.toolchain} calibration directories in ${calibrationRoot}.`);
  // A toolchain built with OpenMP runs the thread count its descriptor measured; libomp would otherwise start one per core, and
  // MATISSE's memory grows with them.
  const openmp = (await toolchainDescriptor(reduction.toolchain)).entry.openmp;
  const threads = openmp === undefined ? 1 : requireFiniteNumber(requireRecord(openmp, `${reduction.toolchain} openmp`).threads);
  const pipeline = esoEnvironment(resolve(root, 'pipeline'), resolve(work, 'home'), { OMP_NUM_THREADS: String(threads) });
  const tree = await associationTree(dpId, work);
  const calibration = resolve(calibrationRoot, kits[0]!);
  const calibrators = await Promise.all(calibratorIds.map(async id => ({ dpId: id, tree: await associationTree(id, work) })));
  const result = await reduceAssociation(reduction, tree, dpId, {
    header: name => archiveHeader(name, resolve(rawDirectory, 'headers')),
    frame: async name => resolve(rawDirectory, `${name}.fits`),
    kitFrame: async pattern => {
      const matches = (await readdir(calibration)).filter(name => pattern.test(name));
      if (matches.length !== 1) throw new Error(`${matches.length} kit files match ${pattern}.`);
      return resolve(calibration, matches[0]!);
    },
    run: (step, recipe, frames, options, categories) => runStep(pipeline, work, step, recipe, frames, options, categories, { directory: rawDirectory, discard: reduction.discardRaw ?? [] }),
  }, calibrators);
  await writeFile(resolve(work, 'calibrated.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

/** The command line every association-driven calibration shares:
 * <science dp_id> <work directory> [--raw <directory>] [--calibrator <dp_id> ...]. */
export async function associationCli(reduction: InstrumentReduction, argv: readonly string[]) {
  const [dpId, work, ...rest] = argv, rawIndex = rest.indexOf('--raw');
  const calibrators = rest.flatMap((value, index) => rest[index - 1] === '--calibrator' ? [value] : []);
  if (!dpId || !work) throw new TypeError(`Usage: calibrate-${reduction.toolchain} <science dp_id> <work directory> [--raw <directory>] [--calibrator <dp_id> ...]`);
  const result = await calibrateFromAssociations(reduction, dpId, resolve(work), resolve(rawIndex < 0 ? resolve(work, 'raw') : rest[rawIndex + 1]!), calibrators);
  console.log(`${result.calibrated}: ${dpId} calibrated with ${result.calibrators.join(', ')} in ${result.steps.length} recipe runs.`);
}
