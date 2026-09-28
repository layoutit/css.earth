/** `new-object --star-limb <id>...`: the limb darkening of stars already in the tree, including packages made by hand.
 *
 * The law comes from the first source that holds the star:
 * 1. a law transcribed from a paper beside the star (`source/photometry/<name>-limb-darkening.json`, cssearth-published-limb-darkening@1,
 *    quadratic or power), a measurement or the model a paper fixed for this star;
 * 2. the model grids of limb.mts, at the star's temperature and gravity (and mass, for spherical models). The gravity is the star's
 *    mass and radius in its astronomy record, else a published spectroscopic value (gravity.mts).
 * A star that already has a colour lens gains the law on it; a placeholder that has none gains the colour lens with it
 * (color.mts, lens.mts). A star no source covers is reported and left unchanged. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { fetchGaiaRow, liveArchive, readIdentifiers, telescopeResolver, type Archive, type GaiaRow, type Identifiers, type Resolver } from './archives.mts';
import { chooseColor } from './color.mts';
import { chooseGravity, type GravityChoice } from './gravity.mts';
import { bindInputs, installColorLens, json, type PackageFiles } from './lens.mts';
import { chooseLimb, type LimbChoice } from './limb.mts';
import type { StarSpec } from './spec.mts';

const GM_SUN = 132712440041.93938;
const PACKAGE_FILES = ['object.json', 'text.json', 'NOTICE.md', 'README.md', 'investigations.json', 'source/manifest.json', 'source/measurements.json',
  'source/preparation/raster.json', 'source/preparation/geometry.json', 'source/preparation/acquisition.json', 'source/content/object.json'];
// Sentences that said no law is drawn, and nothing else: "No limb darkening is drawn: ...", "... the law is not extrapolated."
const STALE = /(?:^|(?<=\.\s))(?:- )?[^.\n]*(?:\bno limb[- ]darkening\b|\blimb[^.\n]*\bnot extrapolated\b)[^.\n]*(?:\.[^.\n]*extrapolated)?\.[^\S\n]*/gimu;

interface StarGravity { readonly logg: number; readonly kind: 'measured' | GravityChoice['kind']; readonly sentence: string; readonly url?: string }

/** A transcribed law beside the star, when there is one. */
async function publishedLaw(root: string, id: string): Promise<LimbChoice | null> {
  const directory = resolve(root, 'src/objects', id, 'source/photometry');
  const names = (await readdir(directory).catch(() => [] as string[])).filter(name => name.endsWith('-limb-darkening.json'));
  for (const name of names) {
    const record = JSON.parse(await readFile(resolve(directory, name), 'utf8')) as { schema?: string; law?: string; source?: string; band?: string; basis?: string; alpha?: { value: number }; u1?: { value: number }; u2?: { value: number } };
    if (record.schema !== 'cssearth-published-limb-darkening@1') continue;
    const path = `photometry/${name}`, url = /https?:\/\/\S+?(?=[),;]|\s|$)/u.exec(record.source ?? '')?.[0] ?? '';
    const credit = (record.source ?? '').split(/,\s*(?=https?:|Table|Section)/u)[0]!.trim();
    const law = record.law === 'power' ? `the power law I(mu) = mu^${record.alpha?.value} that ${credit} fit to the star's resolved disc (${record.band})`
      : `the quadratic law (u1 ${record.u1?.value}, u2 ${record.u2?.value}) ${credit} ${record.basis === 'model-prior' ? 'fixed from model atmospheres for this star' : 'fit to this star'} (${record.band})`;
    return { limbDarkening: { law: record.law === 'power' ? 'power' : 'quadratic', published: true, path }, sentence: `dimmed toward the limb by ${law}`, credit: `Limb darkening: ${credit}.`,
      inputs: [{ id: `${id}-${name.replace(/\.json$/u, '')}`, path, origin: url, credit, license: 'Factual numerical measurements; source attribution retained',
        acquisition: 'Transcribed from the paper, each value with its quoted cell', redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['assets', 'lenses'],
        sourceBinding: { kind: 'local', reason: 'Published limb-darkening law transcribed with its cells; repinned when edited.' } }] };
  }
  return null;
}

/** Insert or replace the README's limb paragraph, and drop the sentences that said no law was drawn. */
function readmeWithLimb(readme: string, paragraph: string, problem: string) {
  const lines = readme.replace(STALE, '').replace(/[^\S\n]+$/gmu, '').split('\n').filter(line => !line.startsWith('**Limb.**') && !line.startsWith('- **Model limb.**'));
  const evidence = lines.indexOf('## Evidence'), problems = lines.indexOf('## Known problems');
  if (evidence >= 0) lines.splice(evidence, 0, paragraph, ''); else lines.push('', paragraph);
  const at = lines.indexOf('## Known problems');
  if (at >= 0 && problems >= 0) { let end = at + 1; while (end < lines.length && !lines[end]!.startsWith('## ') && !lines[end]!.startsWith('[')) end++; while (lines[end - 1] === '') end--; lines.splice(end, 0, problem); }
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
}

/** The law on an existing colour lens: recipe, plate, lens text, manifest, acquisition and credits. */
function installLimbOnly(files: PackageFiles, id: string, limb: LimbChoice, progress: (line: string) => void) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const raster = read(`${s}/preparation/raster.json`), surface = raster.surfaces.find((entry: { science?: { kind?: string } }) => entry.science?.kind === 'stellar-photometric-color');
  surface.science.limbDarkening = limb.limbDarkening;
  surface.science.qualification = `${String(surface.science.qualification ?? '').replace(STALE, '').replace(/^Uniform photosphere/u, 'Photosphere').trim()} The disc is ${limb.sentence}.`.trim();
  const limbMaterial = raster.emission?.metadata?.limbMaterial;
  if (limbMaterial) limbMaterial.composition = 'black alpha darkens the photosphere according to the selected limb-darkening law; transparent outside the silhouette';
  files.set(`${s}/preparation/raster.json`, json(raster));
  for (const file of limb.files ?? []) files.set(`${s}/${file.path}`, file.text);
  const content = read(`${s}/content/object.json`), control = content.lenses.controls.find((entry: { id: string }) => entry.id === surface.id);
  if (control) {
    control.qualification = `${String(control.qualification ?? '').replace(STALE, '').replace(/\.\s*$/u, '')}; darkening toward the edge from ${limb.limbDarkening && 'published' in limb.limbDarkening ? 'a published law' : 'a model atmosphere'}.`;
    control.notes = `${String(control.notes ?? '').replace(STALE, '').trim()} The darkening toward the edge is ${limb.sentence.replace(/^dimmed toward the limb by /u, '')}.`.trim();
  }
  files.set(`${s}/content/object.json`, json(content));
  // The reader's summary is authored prose: it is not rewritten here, but a summary that still speaks of a uniform disc or of limb
  // darkening is named so it can be corrected by hand.
  const summary = String(read(`${o}/text.json`).datasets?.[surface.id]?.summary ?? '');
  if (/\buniform\b|\blimb\b/iu.test(summary)) progress(`  ${id}: review ${o}/text.json datasets.${surface.id}.summary: "${summary}"`);
  const manifest = read(`${s}/manifest.json`), inputs = limb.inputs ?? [];
  manifest.inputs = [...manifest.inputs.filter((entry: { path: string }) => !inputs.some(input => input.path === entry.path)), ...inputs];
  manifest.generatedIntermediates = (manifest.generatedIntermediates ?? []).map((entry: Record<string, any>) => entry.path !== 'presentation/context.png' ? entry
    : { ...entry, id: 'limb-darkened-disc-context-marker', credit: String(entry.credit).replace('The colour lens as a disc;', 'The colour lens as a disc, dimmed toward the limb by its law;'),
      ...(entry.recipe ? { recipe: { ...entry.recipe, inputs: [...new Set([...entry.recipe.inputs ?? [], ...inputs.map(input => String(input.id))])] } } : {}) });
  files.set(`${s}/manifest.json`, json(manifest));
  const plan = read(`${s}/preparation/acquisition.json`), acquisitions = limb.acquisitions ?? [];
  plan.operations = [...plan.operations.filter((step: { path?: string }) => !acquisitions.some(next => next.path === step.path)), ...acquisitions];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
}

/** A spec the colour routes can read, from a hand-made package's own records. */
function specFromRecords(id: string, body: Record<string, any>, measurements: Record<string, any>): StarSpec {
  const source = String(measurements.effectiveTemperatureSource ?? ''), url = /https?:\/\/[^\s),;]+/u.exec(source)?.[0];
  if (!url) throw new Error(`${id}: source/measurements.json effectiveTemperatureSource cites no URL, so the colour cannot cite its temperature.`);
  return { id, name: body.physical.name, system: `${body.physical.name} system`, description: '', paper: { url, credit: source.split(/[:(]/u)[0]!.trim() },
    radius: { value: body.physical.meanRadiusKm / 695700, source: 'the astronomy record', url }, mass: 'unmeasured',
    temperature: { value: Number(measurements.effectiveTemperatureK), source, url }, planets: [], companions: [], notes: [] } as StarSpec;
}

export async function starLimb(root: string, ids: readonly string[], { archive = liveArchive, resolver = telescopeResolver(root), progress = (_line: string) => {} }: { archive?: Archive; resolver?: Resolver; progress?: (line: string) => void } = {}) {
  const results: { id: string; limb: string; gravity?: string; colour?: string }[] = [];
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
    let gravity: StarGravity | null = gm > 0 ? { logg: Number(Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2).toFixed(2)), kind: 'measured',
      sentence: `log g from the mass and radius in packages/astronomy/data/bodies/${id}.json: ${Math.log10(gm * 1e15 / (radiusKm * 1e5) ** 2).toFixed(3)}` } : null;
    if (!gravity && !published && host.star) {
      const choice = await chooseGravity({ archive, ra: host.star.rightAscensionDegrees, dec: host.star.declinationDegrees, teffK, where: id });
      if (choice) gravity = { logg: choice.logg, kind: choice.kind, sentence: choice.sentence, url: choice.url };
    }
    const limb = published ?? (gravity ? await chooseLimb(id, teffK, gravity.logg, archive, undefined, massSolar) : { sentence: 'No limb darkening is drawn: no gravity of this star is measured or published' });
    if (!limb.limbDarkening) { results.push({ id, limb: `NONE: ${limb.sentence}` }); progress(`  ${id}: no law (${limb.sentence.slice(0, 160)})`); continue; }
    const raster = read(`${s}/preparation/raster.json`), hasColor = raster.surfaces.some((entry: { science?: { kind?: string } }) => entry.science?.kind === 'stellar-photometric-color');
    let colour: string | undefined;
    if (hasColor) installLimbOnly(files, id, limb, progress);
    else {
      const spec = specFromRecords(id, body, measurements), gaia = /Gaia DR3 (?:source )?(\d{6,})/u.exec(JSON.stringify(host.star?.sources ?? {}))?.[1];
      const found = await resolver(body.physical.name), ids2: Identifiers = found ? readIdentifiers(found.mainId, found.identifiers) : readIdentifiers(body.physical.name, []);
      const row: GaiaRow = gaia ? (await fetchGaiaRow(archive, gaia)).row : { sourceId: '', ra: host.star.rightAscensionDegrees, dec: host.star.declinationDegrees, g: Number.NaN, hasXpSampled: false };
      const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
      const color = await chooseColor(spec, row, { ...ids2, ...(gaia ? { gaia } : {}) }, archive, cmf);
      const installed = await installColorLens(files, id, color, limb);
      colour = `${installed.hex} from ${color.route}`;
      files.set(`${o}/NOTICE.md`, `${String(files.get(`${o}/NOTICE.md`) ?? '').trimEnd()}\n\n${color.credits.join('\n\n')}\n`);
      files.set(`${o}/README.md`, readmeWithLimb(String(files.get(`${o}/README.md`) ?? ''), `**Colour lens.** ${color.summary.charAt(0).toUpperCase()}${color.summary.slice(1)}, through the CIE 1931 2° observer: ${installed.hex}. Routes tried in order: ${[...color.tried, `${color.route}: used`].join('; ')}.`, ''));
    }
    bindInputs(files, id);
    const measured = limb.limbDarkening && 'published' in limb.limbDarkening;
    files.set(`${o}/NOTICE.md`, `${String(files.get(`${o}/NOTICE.md`) ?? '').replace(/\n\nLimb darkening: [^\n]*/gu, '').trimEnd()}\n\n${limb.credit}\n`);
    files.set(`${o}/README.md`, readmeWithLimb(String(files.get(`${o}/README.md`) ?? ''), `**Limb.** The disc is ${limb.sentence}.${gravity ? ` Gravity: ${gravity.sentence}.` : ''}`,
      measured ? '- **Measured limb, other band.** The law was measured or fixed outside the visible band the colour is drawn in; the visible limb is not measured.' : `- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and ${gravity?.kind === 'bounded' ? 'a display gravity' : 'gravity'}, not a measurement of this star.`));
    if (gravity && !measurements.surfaceGravityLogg && gravity.kind !== 'bounded') { measurements.surfaceGravityLogg = gravity.logg; measurements.surfaceGravitySource = `${gravity.sentence}${gravity.url ? ` (${gravity.url})` : ''}`; files.set(`${s}/measurements.json`, json(measurements)); }
    const ledgerPath = `${o}/investigations.json`, ledger = files.has(ledgerPath) ? read(ledgerPath) : { schema: 'cssearth-investigation-ledger@1', objectId: id, entries: [] };
    ledger.entries = [...ledger.entries.filter((entry: { id: string }) => entry.id !== 'limb-darkening'), { id: 'limb-darkening', subject: 'Limb darkening', status: 'included',
      finding: `The disc is ${limb.sentence}.${gravity ? ` Gravity: ${gravity.sentence}.` : ''}`, evidence: [...new Set([...(limb.inputs ?? []).map(input => String(input.origin)).filter(Boolean), ...(gravity?.url ? [gravity.url] : [])])] }];
    files.set(ledgerPath, json(ledger));
    for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
    results.push({ id, limb: limb.grid ?? 'published', ...(gravity ? { gravity: `${gravity.logg} (${gravity.kind})` } : {}), ...(colour ? { colour } : {}) });
    progress(`  ${id}: limb ${limb.grid ?? 'published'}${gravity ? `, log g ${gravity.logg} (${gravity.kind})` : ''}${colour ? `, colour ${colour}` : ''}`);
  }
  return results;
}
