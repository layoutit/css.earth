/** `new-object --star-limb <id>...`: the limb darkening of stars already in the tree, including packages made by hand.
 *
 * The law comes from the first source that holds the star:
 * 1. a law transcribed from a paper beside the star (`source/photometry/<name>-limb-darkening.json`, cssearth-published-limb-darkening@1,
 *    quadratic or power), a measurement or the model a paper fixed for this star. A law that is not the paper's own value for
 *    the star says how it follows in `derived`, and the star's texts say it in those words: a power law from sizes a paper
 *    prints, or the row of a model grid nearest a star no grid reaches (a white dwarf past the grid's hottest model);
 * 2. the model grids of limb.mts, at the star's temperature and gravity (and mass, for spherical models). The gravity is the star's
 *    mass and radius in its astronomy record, else a published spectroscopic value (gravity.mts), searched at the star's J2000
 *    position: the record's, carried back from its own epoch by its proper motion.
 * 3. the star's own calibrated interferometry, fitted inside the first lobe, when an observation season records it
 *    (interferometric-limb.mts); the record is written beside the star and read as in 1.
 * A star that already has a color dataset gains the law on it; a placeholder that has none gains the color dataset with it
 * (color.mts, dataset.mts). A star no source covers is reported and left unchanged.
 *
 * A generated star with no mass said in its README that no gravity is published, and a draft that found none declined a law in its
 * stored spec. When the law is read at a published gravity, both take it: the README names the paper, and the stored spec cites the
 * gravity as a draft of the star now would (gravity.mts citedGravity), so `--refresh` regenerates the star with its law. */
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { PUBLISHED_LIMB_DARKENING_SCHEMA, INVESTIGATION_LEDGER_SCHEMA, readPublishedPowerLaw, readPublishedLimbDarkening } from '@cssearth/objects';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { fetchGaiaRow, liveArchive, readIdentifiers, telescopeResolver, type Archive, type GaiaRow, type Identifiers, type Resolver } from '../archives/archives.mts';
import { chooseColor } from '../color.mts';
import { chooseGravity, citedGravity, type GravityChoice } from '../archives/gravity.mts';
import { simbadPosition } from '../generate.mts';
import { fitInterferometricLimb } from '../archives/interferometric-limb.mts';
import { bindInputs, installColorDataset, json, type PackageFiles } from '../dataset.mts';
import { chooseLimb, GRIDS, HOWARTH, whiteDwarfGrid } from './limb.mts';
import type { LimbChoice } from './limb-choice.mts';
import { STORED_SPEC } from '../refresh.mts';
import { parseStarSpec, whiteDwarfSpec } from '../spec.mts';
import type { StarSpec } from '../spec-types.mts';

const GM_SUN = 132712440041.93938;
const parseWhiteDwarf = (entry: unknown, id: string) => { const value = (entry as { whiteDwarf?: unknown } | null)?.whiteDwarf; return value === undefined ? undefined : whiteDwarfSpec(value, `${id}.whiteDwarf`); };
const PACKAGE_FILES = ['object.json', 'text.json', 'NOTICE.md', 'README.md', 'investigations.json', 'source/manifest.json', 'source/measurements.json',
  'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json'];
// Sentences that said no law is drawn, and nothing else: "No limb darkening is drawn: ...", "... the law is not extrapolated."
const STALE = /(?:^|(?<=\.\s))(?:- )?[^.\n]*(?:\bno limb[- ]darkening\b|\blimb[^.\n]*\bnot extrapolated\b)[^.\n]*(?:\.[^.\n]*extrapolated)?\.[^\S\n]*/gimu;

// The sentence limb.mts writes when no grid reaches the star: its list of grids holds decimals and nested brackets STALE would cut at.
const NO_GRID = /(?:The disc is )?No limb darkening is drawn: at [\d,]+ K and log g [\d.]+[^(\n]*no model grid used here reaches it \((?:[^()\n]|\((?:[^()\n]|\([^()\n]*\))*\))*\)\.?[^\S\n]*/gu;
const stale = (text: unknown) => String(text ?? '').replace(NO_GRID, '').replace(STALE, '');

interface StarGravity { readonly logg: number; readonly kind: 'measured' | GravityChoice['kind']; readonly sentence: string; readonly url?: string; readonly published?: GravityChoice }
// The last sentence of a generated README's Star paragraph when the star has no mass: none published, or the one an earlier run named.
const STAR_GRAVITY = /^(\*\*Star\.\*\* .*?) (?:No surface gravity of this star is published\.|log g -?[\d.]+ from \d{4}[^\n]*)$/mu;
const SIMBAD_CITED = /^(?:SIMBAD's compilation of spectroscopic measurements|A gravity measured from the star's Stroemgren photometry)/u;

/** A star's stored spec citing the published gravity its law is read at, in place of the decline or of the gravity an earlier run
 * cited. A spec that cites a gravity of its own, or is a hosted body's, is left as it is (null). */
function specWithGravity(stored: Record<string, unknown> | null, choice: GravityChoice) {
  const earlier = (stored?.gravity as { source?: unknown } | undefined)?.source;
  if (!stored || typeof stored.host === 'string' || !(stored.limb !== undefined || (typeof earlier === 'string' && SIMBAD_CITED.test(earlier)))) return null;
  const spec = Object.fromEntries(Object.entries(stored).filter(([key]) => key !== 'limb' && key !== 'gravity').flatMap(([key, value]) => key === 'temperature' ? [[key, value], ['gravity', citedGravity(choice)]] : [[key, value]]));
  parseStarSpec(spec);
  return `${JSON.stringify(spec, null, 2)}\n`;
}

/** A transcribed law beside the star, when there is one. */
async function publishedLaw(root: string, id: string): Promise<LimbChoice | null> {
  const directory = resolve(root, 'src/objects', id, 'source/photometry');
  const names = (await readdir(directory).catch(() => [] as string[])).filter(name => name.endsWith('-limb-darkening.json'));
  for (const name of names) {
    const record = requireRecord(JSON.parse(await readFile(resolve(directory, name), 'utf8')), 'published limb darkening');
    if (record.schema !== PUBLISHED_LIMB_DARKENING_SCHEMA) continue;
    const coefficients = record.law === 'power' ? readPublishedPowerLaw(record) : readPublishedLimbDarkening(record);
    const fit = record.fit === undefined ? undefined : requireRecord(record.fit, 'limb fit');
    // A fitted law's origin is the origin of the file it was fitted to, as the star's manifest records it.
    const fitted = fit && ((JSON.parse(await readFile(resolve(root, 'src/objects', id, 'source/manifest.json'), 'utf8')) as { inputs?: { path: string; origin?: string }[] }).inputs ?? []).find(input => input.path === fit.input)?.origin;
    const path = `photometry/${name}`, url = fitted ?? /https?:\/\/\S+?(?=[),;]|\s|$)/u.exec(requireString(record.source, 'source'))?.[0] ?? '';
    const credit = (requireString(record.source, 'source')).split(/,\s*(?=https?:|Table|Section)/u)[0]!.trim();
    // A law fitted in this package to a pinned input says so, and names the tool that refits it; any other record is a paper's.
    const terms = coefficients.law === 'power' ? `power law I(mu) = mu^${coefficients.alpha}` : `quadratic law (u1 ${coefficients.u1}, u2 ${coefficients.u2})`;
    const law = fit ? `the ${terms} fitted in this package to ${fit.data} (${record.band})`
      : record.derived !== undefined ? `the ${terms} ${requireString(record.derived, 'derived')} (${record.band})`
      : coefficients.law === 'power' ? `the ${terms} that ${credit} fit to the star's resolved disc (${record.band})`
      : `the ${terms} ${credit} ${record.basis === 'model-prior' ? 'fixed from model atmospheres for this star' : 'fit to this star'} (${record.band})`;
    // A row of a model grid chosen for the star, not a paper's own value for it: the nearest tabulated model.
    const nearestModel = record.derived !== undefined && record.basis === 'model-prior';
    return { limbDarkening: { law: record.law === 'power' ? 'power' : 'quadratic', published: true, path }, sentence: `dimmed toward the limb by ${law}`, credit: `Limb darkening: ${credit}.`, ...(nearestModel ? { nearestModel } : {}),
      inputs: [{ id: `${id}-${name.replace(/\.json$/u, '')}`, path, origin: url, credit, license: 'Factual numerical measurements; source attribution retained',
        acquisition: fit ? `Fitted by ${fit.tool} to ${fit.input}` : 'Transcribed from the paper, each value with its quoted cell', redistribution: fit ? 'A fitted parameter with its method; no paper figures' : 'Factual parameter transcription only; no paper figures', consumers: ['assets', 'datasets'],
        sourceBinding: { kind: 'local', reason: fit ? 'Limb-darkening law fitted in this package, with the refit that checks it; repinned when edited.' : 'Published limb-darkening law transcribed with its cells; repinned when edited.' } }] };
  }
  return null;
}

/** Insert or replace the README's limb paragraph, and drop the sentences that said no law was drawn. */
function readmeWithLimb(readme: string, paragraph: string, problem: string) {
  const lines = stale(readme).replace(/[^\S\n]+$/gmu, '').split('\n').filter(line => !line.startsWith('**Limb.**') && !line.startsWith('- **Model limb.**') && !line.startsWith('- **Measured limb, other band.**'));
  const evidence = lines.indexOf('## Evidence'), problems = lines.indexOf('## Known problems');
  if (evidence >= 0) lines.splice(evidence, 0, paragraph, ''); else lines.push('', paragraph);
  const at = lines.indexOf('## Known problems');
  if (at >= 0 && problems >= 0) { let end = at + 1; while (end < lines.length && !lines[end]!.startsWith('## ') && !lines[end]!.startsWith('[')) end++; while (lines[end - 1] === '') end--; lines.splice(end, 0, problem); }
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
}

// A model grid's table beside the star. One the new law does not read was the earlier law's, and leaves with it.
const GRID_FILES = new Set([...GRIDS, whiteDwarfGrid('DA')].map(grid => grid.file));
const supersededGrid = (path: unknown, limb: LimbChoice) => typeof path === 'string' && (GRID_FILES.has(path) || path.startsWith(`${HOWARTH.directory}/`)) && !(limb.inputs ?? []).some(input => input.path === path);
/** The sentence an earlier run wrote, from the ledger entry it left: a rerun replaces it instead of adding a second. */
const earlierSentence = (ledger: Record<string, any> | null) => /^The disc is (.*?)\.(?: Gravity: .*)?$/su.exec(String(ledger?.entries?.find((entry: { id: string }) => entry.id === 'limb-darkening')?.finding ?? ''))?.[1];
const without = (text: unknown, sentence: string | undefined) => (sentence ? String(text ?? '').split(sentence).join('') : String(text ?? '')).replace(/[^\S\n]{2,}/gu, ' ');
const EDGE = /darkening toward the edge from (?:a published law|a model atmosphere)/u;

/** The law on an existing color dataset: recipe, plate, dataset text, manifest, acquisition and credits. Returns the tables it retired. */
function installLimbOnly(files: PackageFiles, id: string, limb: LimbChoice, earlier: string | undefined, progress: (line: string) => void) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const raster = read(`${s}/preparation/raster.json`), surface = raster.surfaces.find((entry: { science?: { kind?: string } }) => entry.science?.kind === 'stellar-photometric-color');
  surface.science.limbDarkening = limb.limbDarkening;
  surface.science.qualification = `${stale(without(surface.science.qualification, earlier && `The disc is ${earlier}.`)).replace(/^Uniform photosphere/u, 'Photosphere').trim()} The disc is ${limb.sentence}.`.trim();
  const limbMaterial = raster.emission?.metadata?.limbMaterial;
  if (limbMaterial) limbMaterial.composition = 'black alpha darkens the photosphere according to the selected limb-darkening law; transparent outside the silhouette';
  files.set(`${s}/preparation/raster.json`, json(raster));
  for (const file of limb.files ?? []) files.set(`${s}/${file.path}`, file.text);
  const content = read(`${s}/content/object.json`), control = content.datasets.controls.find((entry: { id: string }) => entry.id === surface.id);
  if (control) {
    const edge = `darkening toward the edge from ${limb.limbDarkening && 'published' in limb.limbDarkening ? 'a published law' : 'a model atmosphere'}`, qualification = stale(control.qualification);
    control.qualification = EDGE.test(qualification) ? qualification.replace(EDGE, edge) : `${qualification.replace(/\.\s*$/u, '')}; ${edge}.`;
    control.notes = `${stale(without(control.notes, earlier && `The darkening toward the edge is ${earlier.replace(/^dimmed toward the limb by /u, '')}.`)).trim()} The darkening toward the edge is ${limb.sentence.replace(/^dimmed toward the limb by /u, '')}.`.trim();
  }
  files.set(`${s}/content/object.json`, json(content));
  // The reader's summary is authored prose: it is not rewritten here, but a summary that still speaks of a uniform disc or of limb
  // darkening is named so it can be corrected by hand.
  const summary = String(read(`${o}/text.json`).datasets?.[surface.id]?.summary ?? '');
  if (/\buniform\b|\blimb\b|\bdarkening\b/iu.test(summary)) progress(`  ${id}: review ${o}/text.json datasets.${surface.id}.summary: "${summary}"`);
  const manifest = read(`${s}/manifest.json`), inputs = limb.inputs ?? [];
  const retired = manifest.inputs.filter((entry: { path: string }) => supersededGrid(entry.path, limb)), retiredIds = new Set(retired.map((entry: { id?: string }) => entry.id));
  const current = (recipe: Record<string, any>) => ({ ...recipe, inputs: (recipe.inputs ?? []).filter((input: string) => !retiredIds.has(input)) });
  manifest.inputs = [...manifest.inputs.filter((entry: { path: string }) => !retired.includes(entry) && !inputs.some(input => input.path === entry.path)).map((entry: Record<string, any>) => entry.recipe ? { ...entry, recipe: current(entry.recipe) } : entry), ...inputs];
  manifest.generatedIntermediates = (manifest.generatedIntermediates ?? []).map((entry: Record<string, any>) => entry.path !== 'presentation/context.png' ? (entry.recipe ? { ...entry, recipe: current(entry.recipe) } : entry)
    : { ...entry, id: 'limb-darkened-disc-context-marker', credit: String(entry.credit).replace('The color dataset as a disc;', 'The color dataset as a disc, dimmed toward the limb by its law;'),
      ...(entry.recipe ? { recipe: { ...entry.recipe, inputs: [...new Set([...current(entry.recipe).inputs, ...inputs.map(input => String(input.id))])] } } : {}) });
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`), acquisitions = limb.acquisitions ?? [];
  plan.operations = [...plan.operations.filter((step: { path?: string }) => !supersededGrid(step.path, limb) && !acquisitions.some(next => next.path === step.path)), ...acquisitions];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  return retired.map((entry: { path: string }) => `${s}/${entry.path}`) as string[];
}

/** A spec the color routes can read, from a hand-made package's own records. */
function specFromRecords(id: string, body: Record<string, any>, measurements: Record<string, any>): StarSpec {
  const source = String(measurements.effectiveTemperatureSource ?? ''), url = /https?:\/\/[^\s),;]+/u.exec(source)?.[0];
  if (!url) throw new Error(`${id}: source/measurements.json effectiveTemperatureSource cites no URL, so the color cannot cite its temperature.`);
  return { id, name: body.physical.name, system: `${body.physical.name} system`, description: '', paper: { url, credit: source.split(/[:(]/u)[0]!.trim() },
    radius: { value: body.physical.meanRadiusKm / 695700, source: 'the astronomy record', url }, mass: 'unmeasured',
    temperature: { value: Number(measurements.effectiveTemperatureK), source, url }, planets: [], companions: [], notes: [] } as StarSpec;
}

export async function starLimb(root: string, ids: readonly string[], { archive = liveArchive, resolver = telescopeResolver(root), progress = (_line: string) => {} }: { archive?: Archive; resolver?: Resolver; progress?: (line: string) => void } = {}) {
  const results: { id: string; limb: string; gravity?: string; color?: string }[] = [];
  for (const id of ids) {
    const o = `src/objects/${id}`, s = `${o}/source`, files: PackageFiles = new Map();
    for (const path of PACKAGE_FILES) { const text = await readFile(resolve(root, o, path), 'utf8').catch(() => null); if (text !== null) files.set(`${o}/${path}`, text); }
    const read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
    const body = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')) as Record<string, any>;
    const measurements = read(`${s}/measurements.json`), teffK = Number(measurements.effectiveTemperatureK);
    // A companion placed by its orbit takes its sky position from the body it circles (its orbit's host, else its parent).
    let host = body; for (let next = body.hostedOrbit?.host ?? body.physical?.parent; !host.star && next; next = host.hostedOrbit?.host ?? host.physical?.parent) host = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${next}.json`), 'utf8'));
    const gm = Number(body.physical.gravitationalParameterKm3PerS2), radiusKm = Number(body.physical.meanRadiusKm);
    const massSolar = gm > 0 ? Number((gm / GM_SUN).toFixed(3)) : undefined;
    const published = await publishedLaw(root, id);
    let unusable: string | undefined;
    let gravity: StarGravity | null = gm > 0 ? { logg: Number(Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2).toFixed(2)), kind: 'measured',
      sentence: `log g from the mass and radius in packages/astronomy/data/bodies/${id}.json: ${Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2).toFixed(3)}` } : null;
    if (!gravity && !published && host.star) {
      // SIMBAD's positions are J2000; a record is at its catalogue's epoch (Gaia's 2016, Hipparcos's 1991.25), arcseconds away for a nearby star.
      const star = host.star as Record<string, unknown>, number = (key: string) => requireFiniteNumber(star[key], `${id}: star.${key}`);
      const at = simbadPosition({ ra: number('rightAscensionDegrees'), dec: number('declinationDegrees'), epoch: number('positionEpochJulianYear') },
        { ra: star.properMotionRaMasPerYear === undefined ? 0 : number('properMotionRaMasPerYear'), dec: star.properMotionDecMasPerYear === undefined ? 0 : number('properMotionDecMasPerYear') });
      const choice = await chooseGravity({ archive, ...at, teffK, where: id, radiusSolar: radiusKm / 695700, contradicted: sentence => { unusable = sentence; } });
      if (choice) gravity = { logg: choice.logg, kind: choice.kind, sentence: choice.sentence, url: choice.url, ...(choice.kind === 'published' ? { published: choice } : {}) };
    }
    // A white dwarf's stored spec cites its atmosphere class, which names the grid its law is read from (limb.mts).
    const stored = await readFile(resolve(root, o, STORED_SPEC), 'utf8').then(text => JSON.parse(text) as Record<string, any>, () => null);
    const whiteDwarf = parseWhiteDwarf((stored?.companions as { id?: string }[] | undefined)?.find(entry => entry.id === id) ?? stored, id);
    let limb: LimbChoice = published ?? (gravity ? await chooseLimb(id, teffK, gravity.logg, archive, undefined, massSolar, whiteDwarf?.atmosphere) : { sentence: `No limb darkening is drawn: ${unusable ?? 'no gravity of this star is measured or published'}` });
    if (whiteDwarf && !published) limb = { ...limb, sentence: `${limb.sentence}; its atmosphere is ${whiteDwarf.atmosphere}: ${whiteDwarf.source} (${whiteDwarf.url})` };
    // No paper and no grid: the star's own calibrated interferometry, fitted inside the first lobe (interferometric-limb.mts).
    if (!limb.limbDarkening && await fitInterferometricLimb(root, id, progress)) limb = (await publishedLaw(root, id)) ?? limb;
    if (!limb.limbDarkening) { results.push({ id, limb: `NONE: ${limb.sentence}` }); progress(`  ${id}: no law (${limb.sentence.slice(0, 160)})`); continue; }
    const raster = read(`${s}/preparation/raster.json`), hasColor = raster.surfaces.some((entry: { science?: { kind?: string } }) => entry.science?.kind === 'stellar-photometric-color');
    let colorNote: string | undefined, retired: string[] = [];
    if (hasColor) retired = installLimbOnly(files, id, limb, earlierSentence(files.has(`${o}/investigations.json`) ? read(`${o}/investigations.json`) : null), progress);
    else {
      const spec = specFromRecords(id, body, measurements), gaia = /Gaia DR3 (?:source )?(\d{6,})/u.exec(JSON.stringify(host.star?.sources ?? {}))?.[1];
      const found = await resolver(body.physical.name), ids2: Identifiers = found ? readIdentifiers(found.mainId, found.identifiers) : readIdentifiers(body.physical.name, []);
      const row: GaiaRow = gaia ? (await fetchGaiaRow(archive, gaia)).row : { sourceId: '', ra: host.star.rightAscensionDegrees, dec: host.star.declinationDegrees, g: Number.NaN, hasXpSampled: false };
      const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
      const color = await chooseColor(spec, row, { ...ids2, ...(gaia ? { gaia } : {}) }, archive, cmf);
      const installed = await installColorDataset(files, id, color, limb);
      colorNote = `${installed.hex} from ${color.route}`;
      files.set(`${o}/NOTICE.md`, `${String(files.get(`${o}/NOTICE.md`) ?? '').trimEnd()}\n\n${color.credits.join('\n\n')}\n`);
      files.set(`${o}/README.md`, readmeWithLimb(String(files.get(`${o}/README.md`) ?? ''), `**Color dataset.** ${color.summary.charAt(0).toUpperCase()}${color.summary.slice(1)}, through the CIE 1931 2° observer: ${installed.hex}. Routes tried in order: ${[...color.tried, `${color.route}: used`].join('; ')}.`, ''));
    }
    bindInputs(files, id);
    const measured = limb.limbDarkening && 'published' in limb.limbDarkening;
    // The gravity a grid law was read at; a published law is read at none.
    const readAt = gravity && limb.grid ? ` Gravity: ${gravity.sentence}.` : '';
    files.set(`${o}/NOTICE.md`, `${String(files.get(`${o}/NOTICE.md`) ?? '').replace(/\n\nLimb darkening: [^\n]*/gu, '').trimEnd()}\n\n${limb.credit}\n`);
    // The published gravity a grid law was read at is the star's: its README and stored spec say so (header).
    const cited = limb.grid ? gravity?.published : undefined, respec = cited ? specWithGravity(stored, cited) : null;
    if (respec) files.set(`${o}/${STORED_SPEC}`, respec);
    if (cited) files.set(`${o}/README.md`, String(files.get(`${o}/README.md`) ?? '').replace(STAR_GRAVITY, (_all, before: string) => `${before} log g ${cited.logg} from ${cited.source}.`));
    files.set(`${o}/README.md`, readmeWithLimb(String(files.get(`${o}/README.md`) ?? ''), `**Limb.** The disc is ${limb.sentence}.${readAt}`,
      limb.nearestModel ? '- **Model limb.** The limb darkening is the nearest tabulated model atmosphere\'s, not a measurement of this star.'
        : measured ? '- **Measured limb, other band.** The law was measured or fixed outside the visible band the color is drawn in; the visible limb is not measured.' : `- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and ${gravity?.kind === 'bounded' ? 'a display gravity' : 'gravity'}, not a measurement of this star.`));
    // The gravity on record is the one a grid law was read at. A published law is read at none, so the star's cited gravity stays.
    if (gravity && limb.grid && measurements.surfaceGravityLogg !== gravity.logg && gravity.kind !== 'bounded') { measurements.surfaceGravityLogg = gravity.logg; measurements.surfaceGravitySource = `${gravity.sentence}${gravity.url ? ` (${gravity.url})` : ''}`; files.set(`${s}/measurements.json`, json(measurements)); }
    const ledgerPath = `${o}/investigations.json`, ledger = files.has(ledgerPath) ? read(ledgerPath) : { schema: INVESTIGATION_LEDGER_SCHEMA, objectId: id, entries: [] };
    ledger.entries = [...ledger.entries.filter((entry: { id: string }) => entry.id !== 'limb-darkening'), { id: 'limb-darkening', subject: 'Limb darkening', status: 'included',
      finding: `The disc is ${limb.sentence}.${readAt}`, evidence: [...new Set([...(limb.inputs ?? []).map(input => String(input.origin)).filter(Boolean), ...(gravity?.url && limb.grid ? [gravity.url] : [])])] }];
    files.set(ledgerPath, json(ledger));
    for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
    for (const path of retired) await rm(resolve(root, path), { force: true });
    results.push({ id, limb: limb.grid ?? 'published', ...(gravity ? { gravity: `${gravity.logg} (${gravity.kind})` } : {}), ...(colorNote ? { color: colorNote } : {}) });
    progress(`  ${id}: limb ${limb.grid ?? 'published'}${gravity ? `, log g ${gravity.logg} (${gravity.kind})` : ''}${colorNote ? `, color ${colorNote}` : ''}`);
  }
  return results;
}
