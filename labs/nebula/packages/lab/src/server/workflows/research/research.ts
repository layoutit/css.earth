/** `research <id>`: the Research step's checklist, written to `src/objects/<id>/source/research.json`. It is gathered
 * from what the object already keeps — its README's Sources section and the `src/sources` records it links, its host's
 * classification, its recipe's geometry and speed table, and the lab subject's configured method and solvers — so the
 * record is reproducible and adds no fact of its own. The Research tab reads the file. */
import { isRecord } from '@cssearth/core';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { nebulaType, readmeSources, sourceKind, symmetryOf, type SourceKind } from '../../../features/research/research-checklist.ts';
import type { LabObject } from '../lab-objects.ts';

export const RESEARCH_SCHEMA = 'cssearth-nebula-research@1';
export const MODEL_METHODS = ['paper-surfaces', 'symmetry', 'kinematic'] as const;
export type ModelMethod = typeof MODEL_METHODS[number];
/** What the object ships today: a model made by a method, an experiment the lab keeps, or nothing yet. */
export type ResearchStatus = 'published' | 'experiment' | 'open';
export interface ResearchItem { label: string; url: string; record?: string }
export interface VelocityItem { label: string; kind: 'doppler-table' | 'long-slit' | 'ifu' | 'echelle' | 'molecular' | 'mentioned'; url?: string; path?: string; record?: string }
export interface ResearchRecord {
  schema: typeof RESEARCH_SCHEMA; id: string; name: string; type: string;
  papers: ResearchItem[]; models: ResearchItem[]; images: ResearchItem[];
  symmetry: { kind: 'axial' | 'published-surfaces' | 'none'; label: string };
  velocity: { available: boolean; items: VelocityItem[] };
  method: { chosen: ModelMethod | 'inference' | 'density'; status: ResearchStatus; available: ModelMethod[]; geometry: string[] };
}

const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`research.json ${name} must be text.`);
  return value;
};
const items = (value: unknown, name: string): ResearchItem[] => {
  if (!Array.isArray(value)) throw new TypeError(`research.json ${name} must be a list.`);
  return value.map((item, index) => {
    if (!isRecord(item)) throw new TypeError(`research.json ${name}[${index}] must be an object.`);
    const url = text(item.url, `${name}[${index}].url`);
    if (!/^https?:\/\//.test(url) && !/^src\/objects\/[a-z0-9-]+\//.test(url)) throw new TypeError(`research.json ${name}[${index}].url must be a web link or an object path.`);
    if (item.record !== undefined && !/^src\/sources\/[a-z0-9][a-z0-9.-]*\.json$/.test(text(item.record, `${name}[${index}].record`)))
      throw new TypeError(`research.json ${name}[${index}].record must name a src/sources record.`);
    return { label: text(item.label, `${name}[${index}].label`), url, ...(item.record === undefined ? {} : { record: item.record as string }) };
  });
};
const VELOCITY_KINDS = ['doppler-table', 'long-slit', 'ifu', 'echelle', 'molecular', 'mentioned'] as const;
/** The record as the tab reads it: every field checked, nothing coerced. */
export function readResearchRecord(value: unknown): ResearchRecord {
  if (!isRecord(value) || value.schema !== RESEARCH_SCHEMA) throw new TypeError(`Expected a ${RESEARCH_SCHEMA} record.`);
  const id = text(value.id, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new TypeError('research.json id must be a src/objects folder name.');
  const symmetry = value.symmetry, velocity = value.velocity, method = value.method;
  if (!isRecord(symmetry) || !['axial', 'published-surfaces', 'none'].includes(symmetry.kind as string)) throw new TypeError('research.json symmetry.kind is axial, published-surfaces or none.');
  if (!isRecord(velocity) || typeof velocity.available !== 'boolean' || !Array.isArray(velocity.items)) throw new TypeError('research.json velocity needs available and items.');
  const velocityItems = velocity.items.map((item, index): VelocityItem => {
    if (!isRecord(item) || !VELOCITY_KINDS.includes(item.kind as VelocityItem['kind'])) throw new TypeError(`research.json velocity.items[${index}].kind is one of ${VELOCITY_KINDS.join(', ')}.`);
    return { label: text(item.label, `velocity.items[${index}].label`), kind: item.kind as VelocityItem['kind'],
      ...(item.url === undefined ? {} : { url: text(item.url, `velocity.items[${index}].url`) }),
      ...(item.path === undefined ? {} : { path: text(item.path, `velocity.items[${index}].path`) }),
      ...(item.record === undefined ? {} : { record: text(item.record, `velocity.items[${index}].record`) }) };
  });
  if (velocity.available !== velocityItems.length > 0) throw new TypeError('research.json velocity.available says whether velocity.items holds any.');
  if (!isRecord(method) || !([...MODEL_METHODS, 'inference', 'density'] as string[]).includes(method.chosen as string) ||
      !['published', 'experiment', 'open'].includes(method.status as string) || !Array.isArray(method.available) ||
      !method.available.every(item => (MODEL_METHODS as readonly unknown[]).includes(item)) || !Array.isArray(method.geometry) || !method.geometry.every(item => typeof item === 'string'))
    throw new TypeError('research.json method needs chosen, status, available methods and geometry kinds.');
  return { schema: RESEARCH_SCHEMA, id, name: text(value.name, 'name'), type: text(value.type, 'type'),
    papers: items(value.papers, 'papers'), models: items(value.models, 'models'), images: items(value.images, 'images'),
    symmetry: { kind: symmetry.kind as ResearchRecord['symmetry']['kind'], label: text(symmetry.label, 'symmetry.label') },
    velocity: { available: velocity.available, items: velocityItems },
    method: { chosen: method.chosen as ResearchRecord['method']['chosen'], status: method.status as ResearchStatus,
      available: method.available as ModelMethod[], geometry: method.geometry as string[] } };
}

/** A link reduced to what names the same page: no scheme, `www.`, trailing slash or arXiv version and view. */
export function linkKey(url: string): string {
  const arxiv = /arxiv\.org\/(?:abs|html|pdf)\/([a-z-]*\/?\d{4,7}(?:\.\d{4,5})?)/i.exec(url);
  if (arxiv) return `arxiv:${arxiv[1]!.toLowerCase()}`;
  const doi = /doi\.org\/(10\.[^\s?#]+)/i.exec(url);
  if (doi) return `doi:${decodeURIComponent(doi[1]!).toLowerCase()}`;
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
}
interface SourceRecord { id: string; kind: string; title: string; url?: string }
export interface SourceIndex { byId: Map<string, SourceRecord>; byLink: Map<string, SourceRecord> }
/** Every `src/sources` record, by id and by each link and identifier it names. */
export async function readSourceIndex(root: string): Promise<SourceIndex> {
  const directory = resolve(root, 'src/sources'), byId = new Map<string, SourceRecord>(), byLink = new Map<string, SourceRecord>();
  const names = (await readdir(directory)).filter(name => name.endsWith('.json'));
  for (let start = 0; start < names.length; start += 256) await Promise.all(names.slice(start, start + 256).map(async name => {
    let value: unknown; try { value = JSON.parse(await readFile(resolve(directory, name), 'utf8')); } catch { return; }
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.kind !== 'string') return;
    const links = (Array.isArray(value.links) ? value.links : []).flatMap(link => isRecord(link) && typeof link.url === 'string' ? [link.url] : []);
    const identifiers = (Array.isArray(value.identifiers) ? value.identifiers : []).flatMap(item => !isRecord(item) || typeof item.value !== 'string' ? []
      : /^doi$/i.test(String(item.type)) ? [`https://doi.org/${item.value}`] : /^arxiv$/i.test(String(item.type)) ? [`https://arxiv.org/abs/${item.value}`] : []);
    const record: SourceRecord = { id: value.id, kind: value.kind, title: typeof value.title === 'string' ? value.title : value.id, ...(links[0] ? { url: links[0] } : {}) };
    byId.set(record.id, record);
    for (const link of [...links, ...identifiers]) if (!byLink.has(linkKey(link))) byLink.set(linkKey(link), record);
  }));
  return { byId, byLink };
}

const kindOf = (record: SourceRecord | undefined, label: string, url: string): SourceKind => {
  const guessed = sourceKind(label, url);
  if (record?.kind === 'publication') return guessed === 'model' ? 'model' : 'paper';
  if (record?.kind === 'model') return 'model';
  // A survey or archive picture whose link is a service query (a HiPS, a cutout) is still the photograph.
  if (guessed === 'other' && record && record.kind !== 'software' && /hips|image|color|photograph|mosaic|cutout/i.test(`${label} ${url} ${record.title} ${record.id}`)) return 'image';
  return guessed;
};
const readOptional = (path: string) => readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return ''; throw error; });
const json = (value: string): unknown => { try { return JSON.parse(value); } catch { return null; } };
const recordPath = (id: string) => `src/sources/${id}.json`;

/** The checklist for one object, from its README, its source records, its host, its recipe and its lab subject. */
export async function buildResearch(root: string, object: LabObject, index: SourceIndex): Promise<ResearchRecord> {
  const directory = resolve(root, object.object);
  const [readme, objectText, recipeText] = await Promise.all([readOptional(resolve(directory, 'README.md')), readOptional(resolve(directory, 'object.json')),
    readOptional(resolve(directory, 'source/recipe.json'))]);
  const host = /"host":\s*"([a-z0-9-]+)"/.exec(objectText)?.[1];
  const [hostContent, hostObject] = host ? await Promise.all([readOptional(resolve(root, `src/objects/${host}/source/content/object.json`)), readOptional(resolve(root, `src/objects/${host}/object.json`))]) : ['', ''];
  const recipe = json(recipeText), geometry = isRecord(recipe) && isRecord(recipe.geometry) ? recipe.geometry : {};
  const geometryKinds = Object.entries(geometry).filter(([, value]) => isRecord(value)).map(([key]) => key).filter(key => key !== 'fadeOutline');
  // A Sources row's record is the src/sources link on the same line; else the record whose links name the same page.
  const sourcesSection = (() => { const lines = readme.split('\n'), start = lines.findIndex(line => /^##\s+Sources\b/.test(line));
    if (start < 0) return [] as string[]; const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line)); return lines.slice(start + 1, end < 0 ? undefined : end); })();
  const rowRecord = (url: string) => {
    const line = sourcesSection.find(row => row.includes(`(${url})`));
    const linked = line && /\]\((?:\.\.\/)*(?:src\/)?sources\/([a-z0-9][a-z0-9.-]*)\.json\)/.exec(line)?.[1];
    return (linked ? index.byId.get(linked) : undefined) ?? index.byLink.get(linkKey(url));
  };
  const papers: ResearchItem[] = [], models: ResearchItem[] = [], images: ResearchItem[] = [], seen = new Set<string>();
  const add = (label: string, url: string, record: SourceRecord | undefined, known?: SourceKind) => {
    const key = record ? `record:${record.id}` : known ? `id:${label}` : linkKey(url);
    if (seen.has(key)) return; seen.add(key);
    const item: ResearchItem = { label, url, ...(record ? { record: recordPath(record.id) } : {}) };
    const kind = known ?? kindOf(record, label, url);
    if (kind === 'paper') papers.push(item); else if (kind === 'model') models.push(item); else if (kind === 'image') images.push(item);
  };
  for (const row of readmeSources(readme)) add(row.label, row.url, rowRecord(row.url));
  // The recipe's geometry names the records its surfaces come from; each is a paper or a published model.
  // A source the recipe names without a record yet is listed by its id, linked to the recipe that names it.
  const geometrySources: string[] = [];
  const visit = (node: unknown) => { if (Array.isArray(node)) node.forEach(visit); else if (isRecord(node)) for (const [key, value] of Object.entries(node)) {
    if (key === 'source' && typeof value === 'string') geometrySources.push(value); else visit(value); } };
  visit(geometry);
  for (const id of geometrySources) {
    const record = index.byId.get(id);
    if (record) add(record.title, record.url ?? recordPath(record.id), record);
    else add(id, `${object.object}/source/recipe.json`, undefined, id.startsWith('publication-') ? 'paper' : undefined);
  }
  const photograph = isRecord(recipe) && isRecord(recipe.source) ? recipe.source : null, publisherUrl = typeof photograph?.publisherUrl === 'string' ? photograph.publisherUrl : null;
  if (publisherUrl && !images.some(item => linkKey(item.url) === linkKey(publisherUrl)))
    add(typeof photograph?.credit === 'string' ? photograph.credit.split(/ \(|;/)[0]!.trim().slice(0, 80) : 'Photograph', publisherUrl, index.byLink.get(linkKey(publisherUrl)));

  // Velocity data: the recipe's speed table, the subject's slit and molecular solvers, and the spectra the README names.
  const velocity: VelocityItem[] = [];
  const shape = isRecord(geometry.shape) ? geometry.shape : null, speeds = shape && isRecord(shape.speeds) ? shape.speeds : null;
  if (speeds && typeof speeds.path === 'string') {
    const record = typeof speeds.source === 'string' ? index.byId.get(speeds.source) : undefined;
    velocity.push({ label: `Doppler table · ${speeds.path}`, kind: 'doppler-table', path: `${object.object}/source/${speeds.path}`, ...(record ? { record: recordPath(record.id) } : {}) });
  }
  if (object.solvers.kinematics) {
    const slit = json(await readOptional(resolve(root, object.solvers.kinematics)));
    const citation = isRecord(slit) && isRecord(slit.citation) ? slit.citation : null;
    velocity.push({ label: `Long slit · ${typeof citation?.label === 'string' ? citation.label.split(',')[0] : 'digitised'}`, kind: 'long-slit', path: object.solvers.kinematics,
      ...(typeof citation?.url === 'string' ? { url: citation.url } : {}) });
  }
  if (object.solvers.jointFit) velocity.push({ label: 'Molecular velocities (joint fit)', kind: 'molecular', path: object.solvers.jointFit.recipe });
  const mentions: [RegExp, VelocityItem['kind'], string][] = [[/integral[- ]field|\bIFU\b|Fabry|velocity cube|SAM-FP/i, 'ifu', 'Velocity cube / IFU'],
    [/long[- ]slit/i, 'long-slit', 'Long-slit spectra'], [/[eé]chelle/i, 'echelle', 'Echelle spectra']];
  for (const [pattern, kind, label] of mentions) if (pattern.test(readme) && !velocity.some(item => item.kind === kind)) velocity.push({ label: `${label} (README)`, kind: 'mentioned', url: `${object.object}/README.md` });

  const symmetryLabel = symmetryOf(object.workflow, geometryKinds);
  const symmetry: ResearchRecord['symmetry'] = object.workflow === 'symmetry' ? { kind: 'axial', label: symmetryLabel }
    : object.kind === 'plates' ? { kind: 'published-surfaces', label: symmetryLabel } : { kind: 'none', label: symmetryLabel };
  const available: ModelMethod[] = [];
  if (object.kind === 'plates' && geometryKinds.length || models.length) available.push('paper-surfaces');
  if (object.workflow === 'symmetry' || object.solvers.symmetry) available.push('symmetry');
  if (velocity.some(item => item.kind === 'long-slit' || item.kind === 'molecular')) available.push('kinematic');
  const chosen: ResearchRecord['method']['chosen'] = object.kind === 'plates' ? 'paper-surfaces' : object.workflow === 'symmetry' ? 'symmetry'
    : object.workflow === 'density' ? 'density' : 'inference';
  // Plates and the symmetry bank ship the chosen method's model; constrained-inference and density volumes predate
  // the surfaces methods and stay experiments until one of those methods models them.
  const status: ResearchStatus = chosen === 'paper-surfaces' || chosen === 'symmetry' ? 'published' : 'experiment';
  return { schema: RESEARCH_SCHEMA, id: object.id, name: object.name, type: nebulaType(json(hostContent), hostObject || objectText),
    papers, models, images, symmetry, velocity: { available: velocity.length > 0, items: velocity },
    method: { chosen, status, available, geometry: geometryKinds } };
}

export const researchPath = (root: string, object: LabObject) => resolve(root, object.object, 'source/research.json');
export async function writeResearch(root: string, object: LabObject, record: ResearchRecord) {
  readResearchRecord(record);
  await writeFile(researchPath(root, object), JSON.stringify(record, null, 2) + '\n');
}
