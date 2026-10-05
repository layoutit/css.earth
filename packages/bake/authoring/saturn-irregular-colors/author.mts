#!/usr/bin/env node
/**
 * Paint irregular moons of Saturn with their published whole-disc color.
 *
 *   node packages/bake/authoring/saturn-irregular-colors/author.mts [--check]
 *
 * Grav and Bauer (2007) measured B-V, V-R and V-I for Ymir and Siarnaq, the two irregular moons of Saturn drawn on a
 * published shape model. `inputs.json` holds their rows of the paper's Table 2 as printed, one per night. For each moon
 * this script combines the nights, writes `source/photometry/disc-color.json` and turns the `model` observation (a no-data
 * grid) into a `color` shape view that names the record (docs/shape-only-material.md). A moon with a measured albedo is
 * scaled to it; one without takes the 6% its size already assumes, and says so as an estimate. `--check` refuses when a
 * package differs from what this script writes.
 */
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { parseDiscColorRecord } from '@cssearth/objects';
import { discIntegratedColor, linearToSrgb, parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';

const projectRoot = checkoutProjectRoot(import.meta.url), check = process.argv.includes('--check');
const INDICES = ['B-V', 'V-R', 'V-I'] as const;
type Index = typeof INDICES[number];
type Json = Record<string, unknown>;
const json = async (path: string): Promise<Json> => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const percent = (value: number) => `${round(value * 100, 1)}%`;
const points = (value: number) => (value * 100).toFixed(1);

const inputs = await json(resolve(import.meta.dirname, 'inputs.json'));
const colors = requireRecord(inputs.colors), measuredAlbedo = requireRecord(inputs.measuredAlbedo), estimatedAlbedo = requireRecord(inputs.estimatedAlbedo);
const instruments = requireRecord(colors.instruments);
// The solar colors, filter wavelengths and illuminant are the ones Eris, Makemake and Haumea already cite.
const reference = await json(resolve(projectRoot, 'src/objects/eris/source/photometry/disc-color.json'));
const referenceManifest = await json(resolve(projectRoot, 'src/objects/eris/source/manifest.json'));
const ILLUMINANT = 'reference/CIE_std_illum_D65.csv', RECORD = 'photometry/disc-color.json', GENERATOR = 'packages/bake/authoring/saturn-irregular-colors/author.mts';
const illuminantBytes = await readFile(resolve(projectRoot, 'src/objects/eris/source', ILLUMINANT));
const illuminantEntry = records(referenceManifest.inputs).find(input => input.path === ILLUMINANT);
if (!illuminantEntry) throw new Error('Eris no longer pins the CIE D65 illuminant.');
const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3), illuminant = parseCieTable(illuminantBytes.toString('utf8'), 1);

/** Inverse-variance mean of the nights. Its uncertainty is the formal error, or the nights' weighted scatter when that is larger. */
function combine(nights: Json[], index: Index) {
  const values = nights.map(night => { const [value, error] = requireArray(night[index]).map(item => requireFiniteNumber(item)); return { value: value!, weight: 1 / error! ** 2 }; });
  const total = values.reduce((sum, { weight }) => sum + weight, 0), mean = values.reduce((sum, { value, weight }) => sum + value * weight, 0) / total;
  const scatter = Math.sqrt(values.reduce((sum, { value, weight }) => sum + weight * (value - mean) ** 2, 0) / total);
  return { value: round(mean, 3), uncertainty: round(Math.max(1 / Math.sqrt(total), scatter), 3) };
}

/** The measured hue at the lightness the catalogue uses for a dark body's dot and label (the gray these moons had). */
const CATALOGUE_GRAY = 0x9a / 255;
function catalogueColor(linear: readonly number[]) {
  const luminance = (rgb: readonly number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  const target = ((CATALOGUE_GRAY + 0.055) / 1.055) ** 2.4;
  const scale = target / luminance(linear);
  return `#${linear.map(channel => Math.round(255 * linearToSrgb(Math.min(1, channel * scale))).toString(16).padStart(2, '0')).join('')}`;
}

const SHAPE_WORDS: Record<string, string> = {
  ymir: 'a triangular light-curve shape', siarnaq: 'an outline traced from a published model',
};
const changed: string[] = [];
async function put(path: string, content: string | Buffer) {
  const previous = await readFile(path).catch(() => null), next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (previous?.equals(next)) return;
  changed.push(path.slice(projectRoot.length + 1));
  if (check) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next);
}
const putJson = (path: string, value: unknown) => put(path, `${JSON.stringify(value, null, 2)}\n`);
function swap(text: string, pairs: readonly (readonly [string, string])[]) {
  return pairs.reduce((result, [from, to]) => result.split(from).join(to), text);
}

for (const body of records(inputs.bodies)) {
  const id = requireString(body.id), name = requireString(body.name), directory = resolve(projectRoot, 'src/objects', id), source = resolve(directory, 'source');
  const nights = records(body.nights), measured = body.albedo === undefined ? null : requireRecord(body.albedo);
  const albedoSource = measured ? measuredAlbedo : estimatedAlbedo, albedo = measured ? requireFiniteNumber(measured.value) : requireFiniteNumber(estimatedAlbedo.value);
  const indices = Object.fromEntries(INDICES.map(index => [index, combine(nights, index)])) as Record<Index, { value: number; uncertainty: number }>;
  const observed = nights.map(night => `${requireString(night.date)} (${requireString(instruments[requireString(night.instrument)])})`).join('; ');
  const paperName = typeof body.paperName === 'string' ? ` The paper spells the moon ${body.paperName}.` : '';
  const variation = typeof body.varies === 'string' ? ` ${body.varies}` : '';

  // 1. The cited record the bake reads.
  const record = {
    schema: 'cssearth-disc-integrated-color@1', objectId: id,
    object: {
      source: requireString(colors.citation), locator: requireString(colors.locator), system: requireString(colors.system),
      note: `${nights.length === 1 ? 'One night' : `Inverse-variance mean of ${nights.length} nights; each uncertainty is the formal error or the nights' weighted scatter, whichever is larger`}: ${observed}.${variation}${paperName}`,
      nights: nights.map(night => ({ ...(night.label ? { label: night.label } : {}), date: night.date, instrument: instruments[requireString(night.instrument)],
        ...Object.fromEntries(INDICES.map(index => { const [value, uncertainty] = requireArray(night[index]); return [index, { value, uncertainty }]; })) })),
      indices,
    },
    geometricAlbedo: measured
      ? { source: requireString(measuredAlbedo.citation), locator: requireString(measuredAlbedo.locator), band: 'V', value: albedo, uncertainty: requireFiniteNumber(measured.uncertainty) }
      : { source: requireString(estimatedAlbedo.citation), locator: requireString(estimatedAlbedo.locator), band: 'V', value: albedo,
        estimate: true, test: requireString(estimatedAlbedo.test),
        note: `Nobody has measured ${name}'s albedo. The color is scaled to the value its published size already assumes; a measurement replaces it.` },
    sun: reference.sun, effectiveWavelengths: reference.effectiveWavelengths,
  };
  const color = discIntegratedColor(parseDiscColorRecord(record), colorMatching, illuminant);
  const hex = `#${color.srgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  await putJson(resolve(source, RECORD), record);
  await put(resolve(source, ILLUMINANT), illuminantBytes);

  const brightness = measured
    ? `scaled to the measured ${percent(albedo)} geometric albedo`
    : `scaled to an assumed ${percent(albedo)} geometric albedo, an estimate`;
  const qualification = measured
    ? 'Whole-disc color and V geometric albedo from published photometry, painted uniformly; the surface itself is unresolved.'
    : `Whole-disc color from published photometry, painted uniformly. Its brightness is an estimate: nobody has measured this moon's albedo, so it takes the ${percent(albedo)} its size assumes. The surface itself is unresolved.`;

  // 2. The recipe: the no-data observation becomes a shape view that names the record.
  const recipePath = resolve(source, 'preparation/terrestrial.json'), recipe = await json(recipePath);
  const raster = requireRecord(recipe.raster), geometry = requireRecord(recipe.geometry);
  const manifestPath = resolve(source, 'manifest.json'), manifest = await json(manifestPath);
  const shapeInput = records(manifest.inputs).find(input => input.path === requireRecord(geometry.radialTerrain).path);
  if (!shapeInput) throw new Error(`${id}: the manifest does not pin the rendered shape.`);
  const shapeId = requireString(shapeInput.id), shapeMeaning = requireString(shapeInput.coverage).replace(/ ?The grid marks unmapped terrain\./u, '').trim();
  raster.observations = [];
  raster.shapeViews = [{ id: 'color', label: 'Color', consumer: 'shape',
    science: { kind: 'disc-integrated-color', source: RECORD, illuminant: ILLUMINANT, qualification } }];
  geometry.mapUrl = geometry.polesUrl = `/scenes/${id}/${id}-color-surface@2x.webp`;
  requireRecord(recipe.presentation).defaultDataset = 'color';
  await putJson(recipePath, recipe);

  // 3. The dataset the page offers.
  const contentPath = resolve(source, 'content/object.json'), content = await json(contentPath), datasets = requireRecord(content.datasets);
  datasets.defaultDataset = 'color'; datasets.labels = { color: 'Color' };
  datasets.controls = [{ id: 'color', label: 'Color', qualification,
    thumbnail: `/scenes/${id}/${id}-color-thumbnail.webp`, surface: `${id}-color-surface@2x.webp`, poles: `${id}-color-surface@2x.webp`,
    source: { id: `${id}-disc-color`, path: '../manifest.json', url: requireString(colors.url) }, falseColor: false,
    notes: `${shapeMeaning} One mean color for the whole disc (Grav and Bauer 2007), ${brightness}; no terrain, albedo pattern or color variation is drawn.` }];
  const resources = records(content.resources).filter(resource => ![colors.url, measuredAlbedo.url].includes(resource.href));
  resources.push({ label: requireString(colors.short), role: 'surface', description: 'Whole-disc colors', href: requireString(colors.url) });
  if (measured) resources.push({ label: requireString(measuredAlbedo.short), role: 'surface', description: 'NEOWISE albedo', href: requireString(measuredAlbedo.url) });
  content.resources = resources;
  await putJson(contentPath, content);

  // 4. The descriptor: one dataset, no longer an illustration, and a catalogue color with the measured hue.
  const descriptorPath = resolve(directory, 'object.json'), descriptor = await json(descriptorPath), properties = requireRecord(descriptor.properties);
  const catalog = requireRecord(properties.catalog);
  records(requireRecord(properties.recipe).surfaces)[0]!.datasets = [{ id: 'color', source: 'content', material: 'lighting' }];
  delete catalog.illustrationDatasets;
  catalog.color = catalogueColor(color.linear);
  await putJson(descriptorPath, descriptor);

  // 5. The manifest: the neutral image leaves, the record and the illuminant enter.
  const tidy = (text: unknown) => swap(requireString(text), [[' and standard missing-data grid', ''], [' and standard grid', ''], [' The grid marks unmapped terrain.', '']]);
  const evidence = (pointer: string) => `src/objects/${id}/source/${RECORD}#/${pointer}`;
  manifest.inputs = [...records(manifest.inputs).filter(input => !['model-surface', `${id}-disc-color`, `${id}-cie-std-illuminant-d65`].includes(requireString(input.id)))
    .map(input => ({ ...input, credit: tidy(input.credit), ...(input.coverage === undefined ? {} : { coverage: tidy(input.coverage) }) })),
  { id: `${id}-disc-color`, path: RECORD, origin: requireString(colors.url),
    credit: `${requireString(colors.short)}, Icarus 191, 267; albedo ${requireString(albedoSource.short)}${measured ? ', ApJ 809, 3' : ', assumed value'}; solar colors Ramírez et al. (2012), ApJ 752, 5; filter wavelengths SVO Filter Profile Service`,
    license: 'Factual numerical measurements; source attribution retained',
    acquisition: `Transcribed B-V, V-R and V-I per night (${requireString(colors.short)}, Table 2) into packages/bake/authoring/saturn-irregular-colors/inputs.json and combined by ${GENERATOR}; ${measured ? 'V geometric albedo (Grav et al. 2015, Table 3)' : 'assumed albedo (Denk et al. 2018)'}; solar color indices and Generic/Bessell effective wavelengths as in src/objects/eris/source/photometry/disc-color.json`,
    redistribution: 'Factual parameter transcription only; no article text or figures', consumers: ['color'],
    sourceBinding: { kind: 'catalogued', references: [
      { catalogueId: requireString(colors.catalogueId), role: 'material', evidence: evidence('object') },
      { catalogueId: requireString(albedoSource.catalogueId), role: 'material', evidence: evidence('geometricAlbedo') },
      { catalogueId: 'ramirez-2012-solar-colors', role: 'reference', evidence: evidence('sun') },
      { catalogueId: 'svo-fps-generic-bessell', role: 'reference', evidence: evidence('effectiveWavelengths') }] } },
  { ...illuminantEntry, id: `${id}-cie-std-illuminant-d65`, consumers: ['color'] }];
  manifest.generatedIntermediates = records(manifest.generatedIntermediates).map(entry => {
    const plan = requireRecord(entry.recipe);
    return { ...entry, credit: tidy(entry.credit), recipe: { ...plan, inputs: [shapeId, `${id}-disc-color`], datasetId: 'color' } };
  });
  await putJson(manifestPath, manifest);
  const neutral = resolve(source, 'material/neutral.png');
  if (await readFile(neutral).then(() => true, () => false)) { changed.push(`src/objects/${id}/source/material/neutral.png`); if (!check) await rm(neutral); }

  // 6. Reader text. A summary has 125 characters and a detail 28 (site/build/prepare/check-preparation-inputs.mts).
  const textPath = resolve(directory, 'text.json'), text = await json(textPath), shapeWords = SHAPE_WORDS[id] ?? 'a light-curve ellipsoid';
  text.datasets = { color: measured
    ? { title: 'Whole-disc color and albedo', detail: 'Measured color', summary: `${name}’s measured average color and brightness on ${shapeWords}. No surface detail has been seen.` }
    : { title: 'Whole-disc color, estimated brightness', detail: 'Color; brightness estimated', summary: `Measured average color on ${shapeWords}. Brightness is an estimate: two moons like it reflect 5% and 6%.` } };
  for (const entry of Object.values(requireRecord(text.datasets))) {
    const { detail, summary } = requireRecord(entry);
    if (requireString(detail).length > 28 || requireString(summary).length > 125) throw new Error(`${id}: dataset text is over its budget (${requireString(detail).length}, ${requireString(summary).length}).`);
  }
  await putJson(textPath, text);

  // 7. The ledger.
  const ledgerPath = resolve(directory, 'investigations.json'), ledger = await json(ledgerPath);
  const entries: Json[] = records(ledger.entries).filter(entry => entry.id !== 'whole-disc-color')
    .map(entry => ({ ...entry, finding: swap(requireString(entry.finding), [['Integrated observations remain separate from the explicit missing-data grid.', 'Integrated observations give one whole-disc color, not a map.']]) }));
  const printed = INDICES.map(index => `${index} ${indices[index].value.toFixed(nights.length === 1 ? 2 : 3)} ± ${indices[index].uncertainty.toFixed(nights.length === 1 ? 2 : 3)}`).join(', ');
  entries.push({ id: 'whole-disc-color', subject: `${name} whole-disc color`, status: 'included',
    finding: `${requireString(colors.short)}, Table 2, measured the unresolved disc: ${printed}${nights.length > 1 ? ` (mean of ${nights.length} nights)` : ''}. The shape is painted in that one color (${hex} in sRGB) through the shared disc-integrated-color method, ${brightness}.${variation} It is one mean, not a map.`,
    ...(measured ? {} : { revisitWhen: `A measured albedo for ${name} replaces the assumed ${percent(albedo)}.` }),
    evidence: [requireString(colors.url), ...(measured ? [requireString(measuredAlbedo.url)] : [requireString(estimatedAlbedo.url), requireString(measuredAlbedo.url)]),
      `https://github.com/layoutit/css.earth/blob/main/src/objects/${id}/source/${RECORD}`] });
  ledger.entries = entries;
  await putJson(ledgerPath, ledger);

  // 8. README and NOTICE.
  const digits = nights.length === 1 ? 2 : 3, shown = (index: Index) => `${indices[index].value.toFixed(digits)} ± ${indices[index].uncertainty.toFixed(digits)}`;
  const largest = Math.max(...INDICES.map(index => indices[index].uncertainty));
  const where = nights.length === 1 ? `on ${observed}` : `as the weighted mean of ${nights.length} nights: ${observed}`;
  const colorBullet = `- **Color:** [${requireString(colors.short)}, Table 2](${requireString(colors.url)}) measured the whole disc at B−V = ${shown('B-V')}, V−R = ${shown('V-R')} and V−I = ${shown('V-I')}, ${where}.${variation}${paperName} [The record](source/photometry/disc-color.json) turns them into one sRGB color, ${hex}, with the method of [shape-only material](../../../docs/shape-only-material.md).`;
  const albedoBullet = measured
    ? `- **Brightness:** [${requireString(measuredAlbedo.short)}, Table 3](${requireString(measuredAlbedo.url)}) measured a visible geometric albedo of ${points(albedo)} ± ${points(requireFiniteNumber(measured.uncertainty))}% from NEOWISE thermal data. The color is scaled to it.`
    : `- **Brightness (an estimate):** nobody has measured ${name}'s albedo. The color is scaled to ${percent(albedo)}, the value [${requireString(estimatedAlbedo.short)}](${requireString(estimatedAlbedo.url)}) assume for its size. The two small irregular moons of Saturn with a measured albedo are Albiorix at 6.2 ± 2.8% and Siarnaq at 5.0 ± 1.7%; eleven irregular moons of Jupiter range from 2.9% to 5.7% ([${requireString(measuredAlbedo.short)}, Table 3](${requireString(measuredAlbedo.url)})).`;
  const problem = `- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied.${largest >= 0.05 ? ` Its color indices carry errors up to ${largest.toFixed(2)} mag, so the hue is uncertain.` : ''}${measured ? '' : ' Its brightness is an estimate and would change with a measured albedo.'}`;
  const readmePath = resolve(directory, 'README.md');
  let readme = swap(await readFile(readmePath, 'utf8'), [
    ['The entire surface uses the standard missing-data grid.', 'The entire surface shows one whole-disc color; no surface detail is mapped.'],
    ['The complete surface uses the shared missing-data grid.', 'The complete surface shows one whole-disc color; no surface detail is mapped.'],
    ['The ordinary shared missing-data grid covers the entire shape.', 'One whole-disc color covers the entire shape.'],
    ['The shared missing-data grid covers the entire shape,', 'One whole-disc color covers the entire shape,'],
    ['neutral no-data image, title source', 'color record, title source'], ['neutral no-data material and reviewed', 'color record and reviewed'],
    ['simplifier and grid as the eventual surface', 'simplifier and color as the eventual surface'],
  ]);
  const withoutOurs = (section: string) => section.split('\n').filter(line => !/^- \*\*(?:Color|Brightness)/u.test(line) && !line.startsWith('- The color is one mean')).join('\n');
  // A section's bullets end before the package's link line ("[Inputs](...) · ..."), which stays last.
  const section = (title: string, add: string[]) => {
    const start = readme.indexOf(`## ${title}\n`), next = readme.indexOf('\n## ', start + 1), links = readme.indexOf('\n[Inputs](', start + 1);
    if (start < 0 || next < 0) throw new Error(`${id}: README has no ${title} section.`);
    const end = links >= 0 && links < next ? links : next;
    const body = withoutOurs(readme.slice(start, end)).replace(/\n+$/u, '');
    readme = `${readme.slice(0, start)}${body}\n\n${add.join('\n\n')}\n${readme.slice(end)}`;
  };
  section('Sources', [colorBullet, albedoBullet]);
  section('Known problems', [problem]);
  await put(readmePath, readme);

  const noticePath = resolve(directory, 'NOTICE.md');
  const notice = swap(await readFile(noticePath, 'utf8'), [
    ['Authored parameter extraction, assumed-depth geometry and missing-data presentation:', 'Authored parameter extraction and assumed-depth geometry:'],
    ['Authored approximation and missing-data grid:', 'Authored approximation:'], ['Authored approximation and standard grid:', 'Authored approximation:'],
  ]).split('\n').filter(line => !line.startsWith('Whole-disc color:')).join('\n').replace(/\n+$/u, '');
  await put(noticePath, `${notice}\n\nWhole-disc color: ${requireString(colors.short)}, Icarus 191, 267. ${measured ? `Albedo: ${requireString(measuredAlbedo.short)}, ApJ 809, 3.` : `Albedo: assumed, after ${requireString(estimatedAlbedo.short)}.`} Solar colors: Ramírez et al. (2012), ApJ 752, 5. Filter wavelengths: SVO Filter Profile Service. CIE standard illuminant D65: International Commission on Illumination, CC BY-SA 4.0.\n`);

  console.log(`${id.padEnd(11)} ${INDICES.map(index => `${index} ${indices[index].value.toFixed(3)}±${indices[index].uncertainty.toFixed(3)}`).join('  ')}  albedo ${albedo}${measured ? '' : ' (assumed)'}  ${hex}  catalogue ${String(catalog.color)}`);
}

// The two papers the catalogue did not hold yet.
const catalogueEntry = (entry: Json, publisher: string, creators: string[], date: string, locator: string) => {
  const doi = requireString(entry.url).replace('https://doi.org/', ''), arxiv = /arXiv:(\S+)$/u.exec(requireString(entry.citation))?.[1];
  return { id: requireString(entry.catalogueId), kind: 'publication', identityLevel: 'work', title: requireString(entry.citation).replace(/, (?:Icarus|ApJ) .*$/u, '').replace(/^(.*?\(\d{4}\)), /u, '$1: '),
    identifiers: [{ type: 'DOI', value: doi }, ...(arxiv ? [{ type: 'arXiv', value: arxiv }] : [])],
    links: [{ role: 'landing', url: requireString(entry.url), label: 'Published article' }, ...(arxiv ? [{ role: 'archive', url: `https://arxiv.org/abs/${arxiv}`, label: 'arXiv preprint' }] : [])],
    evidence: [{ url: `https://arxiv.org/abs/${arxiv}`, checkedOn: requireString(inputs.checkedOn), locator }],
    relations: [], statements: [], publisher, creators, publicationDate: date };
};
await putJson(resolve(projectRoot, 'src/sources', `${requireString(colors.catalogueId)}.json`),
  catalogueEntry(colors, 'Icarus 191, 267-285', ['T. Grav', 'J. Bauer'], '2007', 'Table 2, color photometry'));
await putJson(resolve(projectRoot, 'src/sources', `${requireString(measuredAlbedo.catalogueId)}.json`),
  catalogueEntry(measuredAlbedo, 'The Astrophysical Journal 809, 3', ['T. Grav', 'et al.'], '2015', 'Table 3, thermal fit results'));

if (check && changed.length) { console.error(`Packages differ from the authoring inputs:\n${changed.join('\n')}`); process.exit(1); }
console.log(check ? 'The packages match the authoring inputs.' : `${changed.length} files written.`);
