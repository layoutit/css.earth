/** One published picture as a dataset of a page that already shows a shaped layer bank. A spec entry names the page, the
 * picture and the bank whose walls, surface or rings the picture lies on (`like`); the records of the new bank are that
 * bank's with this picture's own registration, and the page gains a dataset. The generator reads and computes: every
 * sentence a reader sees (the dataset's title and text, what is chosen and why) is the spec's, written by a person. */
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { INVESTIGATION_LEDGER_SCHEMA, OBJECT_SCHEMA, PREPARED_IMAGE_LAYER_BANK_SCHEMA } from '@cssearth/objects';
import { json, type PackageFiles } from '../dataset.mts';
import { TODO } from '../scaffold.mts';
import type { EsaPage, PictureColor, SkyTags } from './esa-image.mts';
import { registerPicture, RIM_FROM, type Place, type Registration } from './registration.mts';

/** A layer bank's own dataset is named `optical` whatever its light: the page's dataset carries the reader's name for it. */
export const BANK_DATASET = 'optical';
/** The widest face a picture is baked at unless its entry says otherwise: the Ring Nebula's near-infrared bank is 4.9 MB at
 * this size (2026-10-04). */
export const FACE_PIXELS = 1500;
const LICENSE = 'CC-BY-4.0', ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, STATUSES = ['included', 'excluded', 'deferred'] as const;

/** A source an entry cites; `checked` is the day a person read it, the run's day when absent. */
export interface PictureSource { readonly catalogueId: string; readonly url: string; readonly label: string; readonly locator: string; readonly checked?: string }
export interface LedgerEntry { readonly id: string; readonly subject: string; readonly status: typeof STATUSES[number]; readonly finding: string; readonly evidence: readonly string[] }
export interface PictureEntry {
  readonly host: string; readonly image: string; readonly bank: string; readonly like: string;
  readonly dataset: { readonly id: string; readonly label: string; readonly title: string; readonly summary: string; readonly description: string };
  /** The wavelengths the picture shows; the page's own table when absent. */
  readonly colors?: readonly string[];
  /** The pixel, from the picture's top left, of the star that stands at the page's place; the tags' own pixel when absent. */
  readonly star?: readonly [number, number];
  /** How that star was found in the picture, as a draft reports it: "the largest patch of saturated pixels within 1 arcsec, 29 px". */
  readonly starFound?: string;
  readonly facePixels?: number;
  /** Laid over the like bank's recipe geometry: the values this picture's light takes on the same walls; null removes one. */
  readonly geometry?: Readonly<Record<string, unknown>>;
  readonly displayModel?: string;
  readonly sources: readonly PictureSource[]; readonly ledger: readonly LedgerEntry[];
}
type Json = Record<string, unknown>;
export interface PictureInputs {
  readonly page: EsaPage; readonly tags: SkyTags; readonly dimensions: readonly [number, number];
  /** Where the tags alone put the recipe's target, and how the entry's star was found when the draft found it. */
  readonly tagged: readonly [number, number];
  readonly like: { readonly recipe: Json; readonly manifest: Json; readonly presentation: Json; readonly provenance: Json };
  readonly host: { readonly content: Json; readonly text: Json };
  readonly checked: string;
}

/** A spec file's `pictures`. An entry a draft left unfinished is refused by the field still to write. */
export function parsePictures(value: unknown): PictureEntry[] {
  const entries = requireArray(requireRecord(value, 'picture spec').pictures, 'pictures').map((entry, index): PictureEntry => {
    const at = `pictures[${index}]`, input = requireRecord(entry, at), text = (record: Json, key: string, where: string) => requireString(record[key], `${where}.${key}`).trim();
    const unwritten = (found: unknown, where: string): void => { if (typeof found === 'string' && found.includes('TODO(')) throw new TypeError(`${where} is still to write: ${found}`);
      if (Array.isArray(found)) found.forEach((one, i) => unwritten(one, `${where}[${i}]`)); else if (isRecord(found)) for (const [key, one] of Object.entries(found)) unwritten(one, `${where}.${key}`); };
    unwritten(input, at);
    const id = (key: string) => { const found = text(input, key, at); if (!ID.test(found)) throw new TypeError(`${at}.${key} ${JSON.stringify(found)} is not an object id (lower case, digits, hyphens).`); return found; };
    const dataset = requireRecord(input.dataset, `${at}.dataset`), datasetId = text(dataset, 'id', `${at}.dataset`);
    if (!ID.test(datasetId)) throw new TypeError(`${at}.dataset.id ${JSON.stringify(datasetId)} is not a dataset id (lower case, digits, hyphens).`);
    const pair = (found: unknown, where: string) => { const list = requireArray(found, where).map(one => requireFiniteNumber(one, where)); if (list.length !== 2) throw new TypeError(`${where} must be two numbers: x and y from the picture's top left.`); return [list[0]!, list[1]!] as const; };
    return { host: id('host'), image: text(input, 'image', at), bank: id('bank'), like: id('like'),
      dataset: { id: datasetId, label: text(dataset, 'label', `${at}.dataset`), title: text(dataset, 'title', `${at}.dataset`), summary: text(dataset, 'summary', `${at}.dataset`), description: text(dataset, 'description', `${at}.dataset`) },
      ...(input.colors === undefined ? {} : { colors: requireArray(input.colors, `${at}.colors`).map(one => requireString(one, `${at}.colors`)) }),
      ...(input.star === undefined ? {} : { star: pair(input.star, `${at}.star`) }), ...(input.starFound === undefined ? {} : { starFound: text(input, 'starFound', at) }),
      ...(input.facePixels === undefined ? {} : { facePixels: requireFiniteNumber(input.facePixels, `${at}.facePixels`) }),
      ...(input.geometry === undefined ? {} : { geometry: requireRecord(input.geometry, `${at}.geometry`) }),
      ...(input.displayModel === undefined ? {} : { displayModel: text(input, 'displayModel', at) }),
      sources: (input.sources === undefined ? [] : requireArray(input.sources, `${at}.sources`)).map((one, i) => { const where = `${at}.sources[${i}]`, source = requireRecord(one, where);
        return { catalogueId: text(source, 'catalogueId', where), url: text(source, 'url', where), label: text(source, 'label', where), locator: text(source, 'locator', where), ...(source.checked === undefined ? {} : { checked: text(source, 'checked', where) }) }; }),
      ledger: (input.ledger === undefined ? [] : requireArray(input.ledger, `${at}.ledger`)).map((one, i) => { const where = `${at}.ledger[${i}]`, row = requireRecord(one, where), status = text(row, 'status', where) as LedgerEntry['status'];
        if (!STATUSES.includes(status)) throw new TypeError(`${where}.status must be one of ${STATUSES.join(', ')}.`);
        return { id: text(row, 'id', where), subject: text(row, 'subject', where), status, finding: text(row, 'finding', where), evidence: requireArray(row.evidence, `${where}.evidence`).map(link => requireString(link, `${where}.evidence`)) }; }) };
  });
  const repeated = entries.map(entry => entry.bank).filter((bank, index, all) => all.indexOf(bank) !== index);
  if (repeated.length) throw new TypeError(`Picture banks repeat: ${repeated.join(', ')}.`);
  return entries;
}

/** The wavelengths a page's table lists, in its order, each once; and a list of them as a reader's phrase: "7.7, 12 and 18 µm". */
export const pageColors = (colors: readonly PictureColor[]) => [...new Set(colors.map(color => color.wavelength))];
export function colorsPhrase(colors: readonly string[]) {
  const parts = colors.map(color => /^(\S+) (\S+)$/u.exec(color)), unit = parts[0]?.[2], shared = parts.every(part => part && part[2] === unit) && colors.length > 1;
  const list = shared ? parts.map(part => part![1]!) : [...colors];
  return `${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? ''}${shared ? ` ${unit}` : ''}`;
}
export const pictureRecordId = (page: Pick<EsaPage, 'id' | 'telescope'>) => `esa${page.telescope.toLowerCase()}-${page.id}`;

/** `over` laid on `base`, key by key: a record goes into the record under it, any other value takes its place, and null removes it. */
const lay = (base: Json, over: Readonly<Record<string, unknown>>): Json => { for (const [key, value] of Object.entries(over)) { if (value === null) delete base[key]; else base[key] = isRecord(value) && isRecord(base[key]) ? lay({ ...base[key] }, value) : value; } return base; };
const copy = <T,>(value: T): T => structuredClone(value);

/** Every record of one picture's bank and its page's dataset; `carried` are the like bank's other inputs, to copy beside
 * the picture. `readme` is written only where the bank has none. */
export function pictureFiles(entry: PictureEntry, inputs: PictureInputs): { readonly files: PackageFiles; readonly readme: string; readonly carried: readonly { readonly from: string; readonly to: string }[]; readonly registration: Registration; readonly todo: readonly string[] } {
  const { page, tags, dimensions: [width, height], like, host, checked } = inputs, { bank, dataset } = entry, files: PackageFiles = new Map(), at = `src/objects/${bank}`, likeAt = `src/objects/${entry.like}/`;
  const likeRecipe = copy(like.recipe), target = requireRecord(likeRecipe.target, `${entry.like} recipe target`) as unknown as Place, likeSource = requireRecord(likeRecipe.source, `${entry.like} recipe source`);
  const star = entry.star ?? inputs.tagged, registration = registerPicture(tags, [width, height], star, target), { observation, plane, pixelArcsec, circleArcsec } = registration;
  const publisher = `ESA/${page.telescope}`, record = pictureRecordId(page), colors = entry.colors ?? pageColors(page.colors), instruments = [...new Set(page.colors.map(color => color.instrument).filter(Boolean))];
  const pixels = `${width} × ${height}`, field = `${(observation.fieldOfViewDeg[0] * 60).toFixed(2)} × ${(observation.fieldOfViewDeg[1] * 60).toFixed(2)} arcmin`, shown = `${instruments.join(' and ')} at ${colorsPhrase(colors)}`;
  const direction = `${pixelArcsec.toFixed(4)} arcsec per pixel and north ${Math.abs(tags.rotationDeg).toFixed(1)}° ${tags.rotationDeg >= 0 ? 'left' : 'right'} of vertical`, centre = `${observation.centerRaDeg}°, ${observation.centerDecDeg}°`;
  const fromTags = (Math.hypot(star[0] - inputs.tagged[0], star[1] - inputs.tagged[1]) * pixelArcsec).toFixed(2);
  const registered = entry.star
    ? `The file's embedded sky tags for scale and direction, ${direction}, and the star for place: the star in the picture, ${entry.starFound ? `${entry.starFound}, ` : ''}pixel ${star.join(', ')}, is set at the recipe's target, so the frame's centre is ${centre}. The tags alone put the star ${fromTags} arcsec from where the picture shows it.`
    : `The file's embedded sky tags, used as they are: ${direction}, the frame's centre at ${centre}. Not measured against a star here.`;
  const mark = entry.star ? 'the star' : 'the recipe\'s target', rim = `between ${(RIM_FROM * circleArcsec).toFixed(1)} and ${circleArcsec} arcsec from ${mark}`;

  // The bank: the like bank's recipe with this picture, its registration and what the entry lays over the geometry.
  const recipe = { ...likeRecipe, id: bank, source: { path: 'source.jpg', dimensions: [width, height], originalDimensions: page.original, publisherUrl: page.page, downloadUrl: page.download, credit: page.credit, license: LICENSE }, observation,
    geometry: lay({ ...requireRecord(likeRecipe.geometry, `${entry.like} recipe geometry`), ...plane }, entry.geometry ?? {}),
    bake: { ...requireRecord(likeRecipe.bake, `${entry.like} recipe bake`), maxFacePixels: entry.facePixels ?? Math.min(Math.max(width, height), FACE_PIXELS) } };
  files.set(`${at}/source/recipe.json`, json(recipe));
  files.set(`${at}/object.json`, json({ schema: OBJECT_SCHEMA, id: bank, type: 'image-layer-bank', properties: { preparation: { source: 'source/recipe.json' }, host: entry.host }, prepared: { format: PREPARED_IMAGE_LAYER_BANK_SCHEMA, url: 'prepared/image-layers.json' } }));

  // The manifest: the picture, then every other input the like bank reads, each beside this bank.
  const likePicture = `${likeAt}source/${requireString(likeSource.path, `${entry.like} recipe source.path`)}`, moved = (path: unknown) => requireString(path, `${entry.like} manifest path`).replace(likeAt, `${at}/`);
  const others = requireArray(like.manifest.inputs, `${entry.like} manifest inputs`).map(input => requireRecord(input, `${entry.like} manifest input`)).filter(input => input.path !== likePicture);
  const manifest = { ...copy(like.manifest), inputs: [{ id: BANK_DATASET, path: `${at}/source/source.jpg`, origin: page.download, sourceUrl: page.page, title: page.title, credit: page.credit, displayCredit: publisher,
    acquisition: `The publisher's JPEG (${width} x ${height} px), downloaded unchanged; not tracked. Its scale and direction on the sky are the file's embedded tags; its place is ${entry.star ? 'set by the star' : 'the tags\' own'} (recipe observation). A display composite, not a calibrated scientific array.`,
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: record, role: 'material', evidence: `${at}/source/provenance.json` }] }, dependencies: [], datasetId: BANK_DATASET, license: `${LICENSE}; retain the complete recorded credit.`,
    capture: { attributions: [{ kind: 'facility', facilityId: page.telescope.toLowerCase(), evidence: page.page }] } }, ...others.map(input => ({ ...input, path: moved(input.path) }))],
  documents: requireArray(like.manifest.documents, `${entry.like} manifest documents`).map(document => { const one = requireRecord(document, `${entry.like} manifest document`); return { ...one, path: moved(one.path) }; }), generatedIntermediates: [] };
  files.set(`${at}/source/manifest.json`, json(manifest));
  files.set(`${at}/source/presentation.json`, json({ ...copy(like.presentation), objectId: bank, defaultDataset: BANK_DATASET, bank: { path: `${at}/prepared/image-layers.json` },
    recipes: [{ id: 'image-layer-recipe', path: `${at}/source/recipe.json` }, { id: 'source-evidence', path: `${at}/source/provenance.json` }], sharedInputs: [],
    datasets: [{ id: BANK_DATASET, label: dataset.label, title: dataset.title, description: dataset.description, summary: dataset.summary, detail: `${pixels} px`,
      facts: [{ id: 'bands', label: 'Colors', value: colorsPhrase(colors) }, { id: 'source-pixels', label: 'Source pixels', value: pixels }, { id: 'coverage', label: 'Field', value: field }, { id: 'license', label: 'License', value: LICENSE }],
      input: BANK_DATASET, preview: { path: `${at}/source/source.jpg`, url: page.download } }] }));
  const displayModel = entry.displayModel ?? requireString(like.provenance.displayModel, `${entry.like} provenance displayModel`);
  files.set(`${at}/source/provenance.json`, json({ schema: 'cssearth-image-layer-provenance@1', title: page.title, publisher, sourceId: page.id, sourcePage: page.page, download: page.download, credit: page.credit, license: LICENSE,
    original: { dimensions: page.original, bands: [page.telescope, ...instruments, ...colors], fieldOfViewDeg: observation.fieldOfViewDeg }, checkedSource: { kind: 'Published JPEG', dimensions: [width, height] },
    geometryEvidence: { inclinationDeg: plane.inclinationDeg, lineOfNodesPaDeg: plane.lineOfNodesPaDeg, reference: `A picture of the sky: the plane is the picture's own tangent plane, perpendicular to the sight line through the picture's centre, so it faces the Sun. That centre is ${registration.starFromCentreArcsec.toFixed(1)} arcsec from ${mark}, which is the whole of the recipe's inclination. Not the orientation of the object itself.` },
    registration: { method: registered, pixelArcsec: Number(pixelArcsec.toPrecision(4)), northClockwiseDeg: observation.northClockwiseDeg }, displayModel,
    coverage: `The published frame inside a circle about ${mark}: the picture fades out ${rim}, the largest circle the frame holds, so no straight edge shows.`,
    acquisition: { url: page.download, dimensions: [width, height], operation: 'Download the publisher\'s JPEG; no crop or resample.' } }));
  files.set(`${at}/investigations.json`, json({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId: bank, entries: [
    { id: page.id, subject: `${publisher} ${page.id}`, status: 'included', finding: `${page.title}: ${shown}; ${pixels} px over ${field}, released ${page.released}. ${registered}`, evidence: [page.page, page.rights] }, ...entry.ledger] }));
  files.set(`src/sources/${record}.json`, json({ id: record, kind: 'data-product', identityLevel: 'work', title: page.title, identifiers: [{ type: `${publisher} image`, value: page.id }],
    links: [{ role: 'landing', url: page.page, label: 'Published source' }, { role: 'original', url: page.download, label: `JPEG, ${width} x ${height} px` }, { role: 'rights', url: page.rights, label: 'Reuse terms' }],
    evidence: [{ url: page.page, checkedOn: checked, locator: `${width} x ${height} px over ${field}; ${shown}; released ${page.released}. ${registered}` }], publisher, relations: [],
    statements: [{ kind: 'credit', text: page.credit, scope: 'Published source', evidence: page.page }, { kind: 'rights', text: 'Creative Commons Attribution 4.0 International; the full credit must be shown.', scope: 'Published source', evidence: page.rights }] }));

  // The page: one more dataset, shown from this bank.
  const content = copy(host.content), datasets = requireRecord(content.datasets, `${entry.host} content datasets`), controls = requireArray(datasets.controls, `${entry.host} dataset controls`).map(control => requireRecord(control, `${entry.host} dataset control`));
  datasets.controls = [...controls.filter(control => control.id !== dataset.id), { id: dataset.id, label: dataset.label, thumbnail: `${entry.host}-dataset-${dataset.id}.webp`, volume: { objectId: bank, datasetId: BANK_DATASET, surface: dataset.id },
    source: { id: `${bank}-${BANK_DATASET}`, path: `../../${bank}/source/manifest.json`, url: page.page }, falseColor: true }];
  files.set(`src/objects/${entry.host}/source/content/object.json`, json(content));
  const text = copy(host.text), texts = requireRecord(text.datasets, `${entry.host} text datasets`), picture: PictureSource = { catalogueId: record, url: page.page, label: `${publisher} ${page.id}: ${page.credit}`, locator: page.title };
  // A source the page's dataset already cites in the same words keeps the day it was read: a run that changes nothing writes nothing.
  const before = texts[dataset.id], cited = isRecord(before) && Array.isArray(before.sources) ? before.sources.filter(isRecord) : [];
  const read = (source: PictureSource) => { const day = cited.find(one => one.catalogueId === source.catalogueId && one.url === source.url && one.label === source.label && one.locator === source.locator)?.checked; return typeof day === 'string' ? day : undefined; };
  texts[dataset.id] = { title: dataset.title, detail: `${pixels} px`, summary: dataset.summary, sources: [picture, ...entry.sources].map(source => ({ catalogueId: source.catalogueId, url: source.url, label: source.label, checked: source.checked ?? read(source) ?? checked, locator: source.locator })) };
  files.set(`src/objects/${entry.host}/text.json`, json(text));

  const name = requireString(like.presentation.name, `${entry.like} presentation name`), parsecs = `${registration.widthPc.toFixed(2)} pc wide at ${Math.round(target.distancePc)} pc`;
  const readme = `# ${name}, ${dataset.label}\n\n${TODO}: one paragraph. What the picture is, what it lies on (the [${entry.like}](../${entry.like}/README.md) bank's walls), and what is chosen here and not measured.\n\n## Sources\n\n| Selected source | Input and meaning |\n| --- | --- |\n` +
    `| [${publisher} ${page.id}](${page.page}) | [Record](../../sources/${record}.json). ${page.title}: ${shown}; ${pixels} px over ${field} (\`source/source.jpg\`, the publisher's JPEG, restored from its origin). Credit: ${page.credit}. A display composite, not calibrated photometry. |\n` +
    entry.sources.map(source => `| [${source.label}](${source.url}) | [Record](../../sources/${source.catalogueId}.json). ${source.locator} |\n`).join('') +
    `\n## The picture\n\n- **Registration:** ${registered}\n- **Depth:** ${TODO}: what the picture's light lies on, and which printed value each color takes.\n- **Size:** ${field}, ${parsecs}.\n- **Rim:** the picture fades out ${rim}, the largest circle the frame holds.\n` +
    `\n## Evidence\n\n${TODO}: the page with this dataset selected, captured headless, and what the capture shows.\n\n## Known problems\n\n- ${TODO}: what is chosen and not measured.\n- Colors are the publisher's display composite, not a measurement.\n`;
  return { files, readme, carried: others.map(input => ({ from: requireString(input.path, `${entry.like} manifest path`), to: moved(input.path) })), registration,
    todo: [`write ${at}/README.md`, `name the ${bank} bank in src/objects/${entry.host}/README.md`] };
}
