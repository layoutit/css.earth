#!/usr/bin/env node
/**
 * Paint asteroid shapes with their measured whole-disc color.
 *
 *   node packages/bake/authoring/asteroid-colors/author.mts [--object=<id>,<id>] [--check]
 *
 * Gaia DR3 published a mean reflectance spectrum (16 bands, 374 to 1034 nm, against the Sun) for 60,518 asteroids, and
 * the JPL Small-Body Database lists a geometric albedo with its reference. `inputs.json` holds both for each body as
 * `fetch.mts` read them. For each body this script writes `source/photometry/disc-color.json` and turns the gray `shape`
 * view into a `color` shape view that names the record (docs/shape-only-material.md). `--check` refuses when a package
 * differs from what this script writes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { DISC_INTEGRATED_COLOR_SCHEMA, parseDiscColorRecord } from '@cssearth/objects';
import { discIntegratedColor, linearToSrgb, parseCieTable } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';

const projectRoot = checkoutProjectRoot(import.meta.url), check = process.argv.includes('--check');
const only = process.argv.find(argument => argument.startsWith('--object='))?.slice(9).split(',');
type Json = Record<string, unknown>;
const json = async (path: string): Promise<Json> => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
const percent = (value: number) => `${Number((value * 100).toFixed(1))}%`;

const inputs = await json(resolve(import.meta.dirname, 'inputs.json'));
const spectra = requireRecord(inputs.spectra), albedoSource = requireRecord(inputs.albedo), bias = requireRecord(inputs.blueBias);
// The illuminant is the file Eris, Makemake and the irregular moons already pin.
const referenceManifest = await json(resolve(projectRoot, 'src/objects/eris/source/manifest.json'));
const ILLUMINANT = 'reference/CIE_std_illum_D65.csv', RECORD = 'photometry/disc-color.json', GENERATOR = 'packages/bake/authoring/asteroid-colors/author.mts';
const illuminantBytes = await readFile(resolve(projectRoot, 'src/objects/eris/source', ILLUMINANT));
const illuminantEntry = records(referenceManifest.inputs).find(input => input.path === ILLUMINANT);
if (!illuminantEntry) throw new Error('Eris no longer pins the CIE D65 illuminant.');
const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3), illuminant = parseCieTable(illuminantBytes.toString('utf8'), 1);
const NORMALIZED_AT_NM = 550;
// A shape in one flat color carries only smooth shading, so its face images need few texels. Measured on Lomia (2026-10-08,
// GPU Chrome at 2x, Pixelmatch 0.1): 32 x 32 texels a budgeted face draws the color view as 128 x 128 does, at the default
// view and zoomed in to 74 km (0 of 921,600 pixels differ), and the Elevation dataset within 0.13%. The page weighs 1.0 MB
// in place of 2.5 MB and bakes in 27 s in place of 69 s.
const FLAT_COLOR_TEXELS_PER_FACE = 32 * 32;

/** The measured hue at the lightness the catalogue uses for a dark body's dot and label (the gray these asteroids had). */
const CATALOGUE_GRAY = 0x9a / 255;
function catalogueColor(linear: readonly number[]) {
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  const scale = ((CATALOGUE_GRAY + 0.055) / 1.055) ** 2.4 / luminance;
  return `#${linear.map(channel => Math.round(255 * linearToSrgb(Math.min(1, channel * scale))).toString(16).padStart(2, '0')).join('')}`;
}

/** JPL names the paper or archive each albedo comes from; this is the short form a reader sees. */
function albedoOrigin(reference: string) {
  if (reference.includes('neowise_diameters_albedos')) {
    const bibcode = /adsabs\.harvard\.edu\/abs\/([^)\s]+)/u.exec(reference)?.[1], paper = bibcode === undefined ? undefined : requireRecord(albedoSource.papers)[bibcode];
    if (typeof paper !== 'string') throw new Error(`inputs.json names no paper for ${reference}.`);
    return { short: `NEOWISE (${paper}; PDS bundle neowise_diameters_albedos 2.0)`, catalogueId: 'neowise-diameters-albedos-v2' };
  }
  if (reference.includes('IRAS-A-FPA-3-RDR-IMPS')) return { short: 'the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0)', catalogueId: 'iras-minor-planet-survey-v6' };
  return { short: `the reference JPL states as "${reference}"`, catalogueId: null };
}

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
const swap = (text: string, pairs: readonly (readonly [string, string])[]) => pairs.reduce((result, [from, to]) => result.split(from).join(to), text);
/** The packages word the gray convention several ways; a colored shape has no gap to mark. */
const ungray = (text: string) => swap(text.replace(/\b(?:the )?(?:neutral gray|grid) marks unavailable imagery/giu, match => /^[A-Z]/u.test(match) ? 'No surface imagery exists' : 'no surface imagery exists'), [
  [" The grid is cssEarth's missing-imagery convention.", ''], ['The grid is an explicit no-imagery treatment; no', 'No'], [' The neutral gray marks missing imagery.', ' The color is one whole-disc mean.'],
  ['The Shape view uses the shared normal grid because the source release provides no registered surface imagery. The grid is a coordinate guide, not regolith, measured albedo or an optical photograph.',
    'The source release provides no registered surface imagery; the shape shows one whole-disc color.'],
  ['Both views therefore retain the shared neutral-gray material or a clearly labeled visualization of the selected model radius.', 'The views therefore show one whole-disc color or a clearly labeled visualization of the selected model radius.'],
]);

for (const body of records(inputs.bodies)) {
  const id = requireString(body.id), name = requireString(body.name), number = requireFiniteNumber(body.number);
  if (only && !only.includes(id)) continue;
  const directory = resolve(projectRoot, 'src/objects', id), source = resolve(directory, 'source');
  const albedo = requireRecord(body.albedo), albedoValue = requireFiniteNumber(albedo.value), origin = albedoOrigin(requireString(albedo.reference));
  const albedoError = albedo.uncertainty === null ? null : requireFiniteNumber(albedo.uncertainty), epochs = requireFiniteNumber(body.epochs);
  const bands = requireArray(body.samples).map(sample => requireArray(sample).map(value => requireFiniteNumber(value)));
  // Gaia flags a band 0 when it validated it; a flagged band is left out and named.
  const used = bands.filter(band => band[3] === 0), omitted = bands.filter(band => band[3] !== 0);
  const sbdb = `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${number}`;

  // 1. The cited record the bake reads.
  const record = {
    schema: DISC_INTEGRATED_COLOR_SCHEMA, objectId: id,
    object: {
      source: requireString(spectra.citation), locator: `Gaia archive table gaiadr3.sso_reflectance_spectrum, number_mp = ${number}`,
      system: `Mean reflectance against the Sun in 16 bands from 374 to 1034 nm, normalized to 1 at ${NORMALIZED_AT_NM} nm`,
      note: `Mean of ${epochs} epoch spectra.${omitted.length ? ` Gaia flags the ${omitted.map(band => `${band[0]} nm`).join(' and ')} band${omitted.length > 1 ? 's' : ''} as not validated; ${omitted.length > 1 ? 'they are' : 'it is'} left out and the neighbouring bands are joined.` : ''}`,
      reflectance: { normalizedAtNm: NORMALIZED_AT_NM, samples: used.map(([wavelengthNm, value, uncertainty]) => ({ wavelengthNm, value, uncertainty })),
        ...(omitted.length ? { omitted: omitted.map(([wavelengthNm, value, uncertainty, flag]) => ({ wavelengthNm, value, uncertainty, flag })) } : {}) },
    },
    geometricAlbedo: { source: `JPL Small-Body Database, physical parameters of (${number}) ${name}`, locator: `albedo; JPL's stated reference: ${requireString(albedo.reference)}`,
      band: 'V', value: albedoValue, ...(albedoError === null ? {} : { uncertainty: albedoError }) },
    effectiveWavelengths: { source: 'The wavelength Gaia normalizes its reflectance spectra at, where the V albedo is applied', nanometres: { V: NORMALIZED_AT_NM } },
  };
  const color = discIntegratedColor(parseDiscColorRecord(record), colorMatching, illuminant);
  const hex = `#${color.srgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  await putJson(resolve(source, RECORD), record);
  await put(resolve(source, ILLUMINANT), illuminantBytes);

  const qualification = 'Whole-disc color from a published reflectance spectrum and V geometric albedo, painted uniformly; the surface itself is unresolved.';
  const brightness = `scaled to the ${percent(albedoValue)} geometric albedo JPL lists`;

  // 2. The recipe: the gray shape view becomes a shape view that names the record.
  const recipePath = resolve(source, 'preparation/terrestrial.json'), recipe = await json(recipePath);
  const raster = requireRecord(recipe.raster), geometry = requireRecord(recipe.geometry);
  const manifestPath = resolve(source, 'manifest.json'), manifest = await json(manifestPath);
  const shapeInput = records(manifest.inputs).find(input => input.path === requireRecord(geometry.radialTerrain).path);
  if (!shapeInput) throw new Error(`${id}: the manifest does not pin the rendered shape.`);
  const shapeId = requireString(shapeInput.id);
  raster.shapeViews = [{ id: 'color', label: 'Color', consumer: 'shape',
    science: { kind: 'disc-integrated-color', source: RECORD, illuminant: ILLUMINANT, qualification } }];
  geometry.mapUrl = geometry.polesUrl = `/scenes/${id}/${id}-color-surface@2x.webp`;
  const radial = requireRecord(geometry.radialTerrain);
  delete radial.texelsPerFace;
  radial.atlasTexels = requireFiniteNumber(radial.faceBudget) * FLAT_COLOR_TEXELS_PER_FACE;
  requireRecord(recipe.presentation).defaultDataset = 'color';
  await putJson(recipePath, recipe);

  // 3. The dataset the page offers, in place of the gray one; any other dataset stays.
  const tidy = (text: unknown) => ungray(requireString(text));
  const contentPath = resolve(source, 'content/object.json'), content = await json(contentPath), datasets = requireRecord(content.datasets);
  // The shape's own qualification stays on the dataset: the old control's notes without the gray convention, else the shape's coverage.
  const GRAY_NOTE = 'Neutral gray (#808080 sRGB) is a shared display convention, not measured surface color or albedo.';
  const previous = records(datasets.controls).find(control => ['shape', 'color'].includes(requireString(control.id)));
  const previousNotes = typeof previous?.notes === 'string' ? ungray(previous.notes.split(' One mean color for the whole disc')[0]!.replace(GRAY_NOTE, '')).trim() : '';
  const shapeWords = previousNotes || tidy(shapeInput.coverage);
  datasets.defaultDataset = 'color';
  if (datasets.labels !== undefined) datasets.labels = { color: 'Color' };
  datasets.controls = [{ id: 'color', label: 'Color', qualification,
    thumbnail: `/scenes/${id}/${id}-color-thumbnail.webp`, surface: `${id}-color-surface@2x.webp`, poles: `${id}-color-surface@2x.webp`,
    source: { id: `${id}-disc-color`, path: '../manifest.json', url: requireString(spectra.url) }, falseColor: false,
    notes: `${shapeWords} One mean color for the whole disc (Gaia DR3 reflectance spectrum), ${brightness}; no terrain, albedo pattern or color variation is drawn.` },
  ...records(datasets.controls).filter(control => !['shape', 'color'].includes(requireString(control.id)))
    .map(control => typeof control.notes === 'string' ? { ...control, notes: ungray(control.notes) } : control)];
  const resources = records(content.resources).filter(resource => ![spectra.url, sbdb].includes(resource.href));
  resources.push({ label: requireString(spectra.short), role: 'surface', description: 'Gaia DR3 reflectance spectrum', href: requireString(spectra.url) },
    { label: 'JPL Small-Body Database', role: 'surface', description: 'Geometric albedo', href: sbdb });
  content.resources = resources;
  await putJson(contentPath, content);

  // 4. The descriptor: the color dataset and a catalogue color with the measured hue.
  const descriptorPath = resolve(directory, 'object.json'), descriptor = await json(descriptorPath), properties = requireRecord(descriptor.properties);
  const catalog = requireRecord(properties.catalog), surface = records(requireRecord(properties.recipe).surfaces)[0]!;
  surface.datasets = [{ id: 'color', source: 'content', material: 'lighting' }, ...records(surface.datasets).filter(dataset => !['shape', 'color'].includes(requireString(dataset.id)))];
  catalog.color = catalogueColor(color.linear);
  await putJson(descriptorPath, descriptor);

  // 5. The manifest: the record and the illuminant enter.
  const evidence = (pointer: string) => `src/objects/${id}/source/${RECORD}#/${pointer}`;
  manifest.inputs = [...records(manifest.inputs).filter(input => ![`${id}-disc-color`, `${id}-cie-std-illuminant-d65`].includes(requireString(input.id)))
    .map(input => ({ ...input, credit: tidy(input.credit), ...(input.coverage === undefined ? {} : { coverage: tidy(input.coverage) }) })),
  { id: `${id}-disc-color`, path: RECORD, origin: requireString(spectra.url),
    credit: `${requireString(spectra.short)}, A&A 674, A35; ESA/Gaia/DPAC; albedo JPL Small-Body Database, from ${origin.short}`,
    license: 'Factual numerical measurements; source attribution retained',
    acquisition: `Queried gaiadr3.sso_reflectance_spectrum at the Gaia archive (${requireString(spectra.tap)}) and the JPL Small-Body Database API for asteroid ${number} with packages/bake/authoring/asteroid-colors/fetch.mts, checked ${requireString(inputs.checked)}; written by ${GENERATOR}`,
    redistribution: 'Factual catalogue values only; Gaia data are released under the ESA/Gaia/DPAC terms with attribution', consumers: ['color'],
    sourceBinding: { kind: 'catalogued', references: [
      { catalogueId: requireString(spectra.catalogueId), role: 'material', evidence: evidence('object') },
      { catalogueId: requireString(albedoSource.catalogueId), role: 'material', evidence: evidence('geometricAlbedo') },
      ...(origin.catalogueId ? [{ catalogueId: origin.catalogueId, role: 'material', evidence: evidence('geometricAlbedo/locator') }] : [])] } },
  { ...illuminantEntry, id: `${id}-cie-std-illuminant-d65`, consumers: ['color'] }];
  // The record and the illuminant are inputs now: a document entry for either would declare the file twice.
  manifest.documents = records(manifest.documents).filter(document => ![RECORD, ILLUMINANT].includes(requireString(document.path)));
  manifest.generatedIntermediates = records(manifest.generatedIntermediates).map(entry => {
    const plan = requireRecord(entry.recipe);
    return { ...entry, credit: tidy(entry.credit), recipe: { ...plan, inputs: [shapeId, `${id}-disc-color`], datasetId: 'color' } };
  });
  await putJson(manifestPath, manifest);

  // 6. Reader text. A summary has 125 characters and a detail 28 (site/build/prepare/check-preparation-inputs.mts).
  const textPath = resolve(directory, 'text.json'), text = await json(textPath);
  const kept = Object.fromEntries(Object.entries(requireRecord(text.datasets)).filter(([key]) => !['shape', 'color'].includes(key)));
  const colorText = { title: 'Whole-disc color and albedo', detail: 'Measured color',
    summary: `${name}’s measured average color and brightness on its light-curve shape. No surface detail has been seen.` };
  if (colorText.summary.length > 125) throw new Error(`${id}: dataset text is over its budget (${colorText.summary.length}).`);
  text.datasets = { color: colorText, ...kept };
  await putJson(textPath, text);

  // 7. The ledger.
  const ledgerPath = resolve(directory, 'investigations.json'), ledger = await json(ledgerPath);
  const entries: Json[] = records(ledger.entries).filter(entry => entry.id !== 'whole-disc-color');
  entries.push({ id: 'whole-disc-color', subject: `${name} whole-disc color`, status: 'included',
    finding: `${requireString(spectra.short)} published the mean of ${epochs} Gaia epoch spectra of the unresolved disc: reflectance against the Sun in 16 bands from 374 to 1034 nm, 1 at 550 nm (${used.find(band => band[0] === 462)![1].toFixed(3)} at 462 nm, ${used.find(band => band[0] === 638)![1].toFixed(3)} at 638 nm). The shape is painted in that one color (${hex} in sRGB) through the shared disc-integrated-color method, ${brightness}${albedoError === null ? '' : ` (± ${percent(albedoError)})`}, from ${origin.short}. It is one mean, not a map. ${requireString(bias.finding)}`,
    evidence: [requireString(spectra.url), sbdb, requireString(bias.url), `https://github.com/layoutit/css.earth/blob/main/src/objects/${id}/source/${RECORD}`] });
  ledger.entries = entries;
  await putJson(ledgerPath, ledger);

  // 8. README and NOTICE.
  const colorBullet = `- **Color:** [${requireString(spectra.short)}](${requireString(spectra.url)}) published ${name}'s reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of ${epochs} Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, ${hex}, with the method of [shape-only material](../../../docs/shape-only-material.md).`;
  const albedoBullet = `- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](${sbdb}) lists, ${percent(albedoValue)}${albedoError === null ? '' : ` ± ${percent(albedoError)}`}, from ${origin.short}.`;
  const problem = `- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. ${requireString(bias.problem)}`;
  const readmePath = resolve(directory, 'README.md');
  let readme = swap(ungray(await readFile(readmePath, 'utf8')), [
    ['Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.',
      'The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.'],
    ['neutral gray marks that gap.', 'the color is one whole-disc mean.'],
    ['the shape shows the shared neutral gray.', 'the shape shows one whole-disc color.'],
  ]);
  const withoutOurs = (part: string) => part.split('\n').filter(line => !/^- \*\*(?:Color|Brightness):/u.test(line) && !line.startsWith('- The color is one mean')).join('\n');
  // A section's bullets end before the package's link line ("[Inputs](...) · ..."), which stays last.
  const section = (title: string, add: string[]) => {
    const start = readme.indexOf(`## ${title}\n`), following = readme.indexOf('\n## ', start + 1), next = following < 0 ? readme.length : following, links = readme.indexOf('\n[Inputs](', start + 1);
    if (start < 0) throw new Error(`${id}: README has no ${title} section.`);
    const end = links >= 0 && links < next ? links : next;
    const kept = withoutOurs(readme.slice(start, end)).replace(/\n+$/u, '');
    readme = `${readme.slice(0, start)}${kept}\n\n${add.join('\n\n')}\n${readme.slice(end)}`;
  };
  section('Sources', [colorBullet, albedoBullet]);
  section('Known problems', [problem]);
  await put(readmePath, readme);

  const noticePath = resolve(directory, 'NOTICE.md');
  const notice = ungray(await readFile(noticePath, 'utf8')).split('\n').filter(line => !line.startsWith('Whole-disc color:')).join('\n').replace(/\n+$/u, '');
  await put(noticePath, `${notice}\n\nWhole-disc color: ${requireString(spectra.short)}, A&A 674, A35. ${requireString(spectra.credit)} Albedo: JPL Small-Body Database, from ${origin.short}. CIE standard illuminant D65: International Commission on Illumination, CC BY-SA 4.0.\n`);

  console.log(`${id.padEnd(16)} ${String(number).padStart(5)}  462 nm ${used.find(band => band[0] === 462)![1].toFixed(3)}  638 nm ${used.find(band => band[0] === 638)![1].toFixed(3)}  albedo ${albedoValue}  ${hex}  catalogue ${String(catalog.color)}`);
}

// The catalogue records the packages cite and the catalogue did not hold yet.
for (const entry of records(inputs.catalogue)) {
  const path = resolve(projectRoot, 'src/sources', `${requireString(entry.id)}.json`);
  if (await readFile(path).catch(() => null)) continue;
  await putJson(path, entry);
}

if (check && changed.length) { console.error(`Packages differ from the authoring inputs:\n${changed.join('\n')}`); process.exit(1); }
console.log(check ? 'The packages match the authoring inputs.' : `${changed.length} files written.`);
