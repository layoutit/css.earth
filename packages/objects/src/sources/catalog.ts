/** Canonical published identities. Local files and claim-specific citations keep their own evidence. */
export const SOURCE_CATALOG_SCHEMA = 'cssearth-source-catalog@1';
export type SourceKind = 'data-product' | 'publication' | 'model' | 'reference-page' | 'software' | 'artwork';
export type SourceRole = 'material' | 'method' | 'reference' | 'artwork';
export type SourceEvidence =
  | { readonly path: string; readonly locator: string }
  | { readonly url: string; readonly checkedOn: string; readonly locator: string };
export interface SourceLink { readonly role: 'landing' | 'archive' | 'original' | 'mirror' | 'rights'; readonly url: string; readonly label: string; }
export interface SourceRecord {
  readonly id: string; readonly kind: SourceKind; readonly identityLevel: 'work' | 'release'; readonly title: string;
  readonly identifiers: readonly { readonly type: string; readonly value: string }[];
  readonly links: readonly SourceLink[]; readonly evidence: readonly SourceEvidence[];
  readonly creators?: readonly string[]; readonly publisher?: string; readonly publicationDate?: string; readonly version?: string;
  readonly relations: readonly { readonly kind: 'version-of' | 'part-of' | 'derived-from'; readonly catalogueId: string; readonly evidence: string }[];
  readonly statements: readonly { readonly kind: 'credit' | 'rights' | 'limitation'; readonly text: string; readonly scope: string; readonly evidence: string }[];
}
export interface SourceCatalog {
  readonly schema: typeof SOURCE_CATALOG_SCHEMA; readonly records: readonly SourceRecord[];
}
export interface SourceCitation { readonly catalogueId: string; readonly checkedOn: string; readonly locator?: string; readonly evidence?: string; }
export interface SourceReference { readonly catalogueId: string; readonly role: SourceRole; readonly evidence: string; readonly locator?: string; }
export type SourceBinding =
  | { readonly kind: 'catalogued'; readonly references: readonly SourceReference[] }
  | { readonly kind: 'local'; readonly reason: string }
  | { readonly kind: 'unresolved'; readonly label: string; readonly evidence: string; readonly reason: string };
export type SourceResolver = Readonly<Record<string, SourceRecord>>;

export function sourceObject(input: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new TypeError('Expected a source record.');
  // Naming the fields is what makes a failure actionable: the reader walks hundreds of records, and a bare
  // refusal leaves a CI log with no object, no field and nothing to grep for.
  const unexpected = keys ? Object.keys(input).filter(key => !keys.includes(key)) : [];
  if (unexpected.length) throw new TypeError(`Unexpected source field ${unexpected.join(', ')}; this record takes ${keys!.join(', ')}.`);
  return input as Record<string, unknown>;
}
export function sourceText(input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input !== input.trim()) throw new TypeError('Expected nonblank source text.');
  return input;
}
export function sourceId(input: unknown): string {
  const id = sourceText(input); if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError(`Invalid source ID: ${id}.`); return id;
}
export function sourceArray<T>(input: unknown, parse: (raw: unknown) => T): readonly T[] {
  if (!Array.isArray(input)) throw new TypeError('Expected a source list.'); return Object.freeze(input.map(raw => parse(raw)));
}
export function sourceEnum<T extends string>(input: unknown, values: readonly T[]): T {
  const value = sourceText(input), result = values.find(candidate => candidate === value);
  if (result === undefined) throw new TypeError(`Unsupported source value: ${value}.`); return result;
}
// The WHATWG URL parser both hosts provide; the package compiles against ES2022 alone, which does not declare it.
declare const URL: new (input: string) => { readonly protocol: string; readonly username: string; readonly password: string };
export function sourceUrl(input: unknown): string {
  const value = sourceText(input);
  if (/[\s{}]/u.test(value)) throw new TypeError('Invalid source URL.');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Invalid source URL.');
  return value;
}
/** Name endings of a file a browser downloads or shows raw, where a reader expects a page: data, tables, images, models,
 * archives, documents and query endpoints. A link whose ending is not listed is taken for a page, so the list grows with
 * the archives used. */
const FILE_ENDING = /\.(?:api|asc|asset|bds|bsp|bz2|csv|cub|das|dat|dbf|dods|ecsv|fit|fits|fz|gif|glb|glsl|gz|h5|hdf|hdr|img|info|jpeg|jpg|json|lbl|lblx|mat|md|mov|mp4|nc|obj|pdf|ply|png|psv|qub|shp|stl|sum|svg|tab|tar|tf|tgz|ti|tif|tiff|tls|tpc|trj|tsv|txt|uce|vg2|vot|webp|wf|wms|wrl|xml|zip)$/iu;
/** Pages whose address ends like a file: a repository's view of a file, a wiki's page about one. */
const FILE_PAGE = /^https?:\/\/(?:github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/|[^/]+\/wiki\/File:)/u;
/** Paths that answer with data whatever their name: a table service's query endpoint (TAP, VizieR ASU), a programming
 * interface (an `api.` host, an `/api/` or `/wp-json/` folder), and a `pdf`, `file` or `datafile` folder's entries. */
const DATA_PATH = /(?:[/-]tap\/a?sync|\/viz-bin\/asu-[a-z]+|\/(?:pdf|file|datafile)\/[^/]+)$|^https?:\/\/(?:api\.[^/]+\/|[^/]+\/(?:.*\/)?(?:api|wp-json)\/)./iu;
/** Whether an address serves a file instead of a page. The form of an address decides; what a server answers is not asked. */
export function isFileAddress(url: string): boolean {
  if (FILE_PAGE.test(url)) return false;
  const [address = ''] = url.split('#'), mark = address.indexOf('?'), path = mark < 0 ? address : address.slice(0, mark);
  const name = path.slice(path.lastIndexOf('/') + 1), query = mark < 0 ? [] : address.slice(mark + 1).split('&');
  if (FILE_ENDING.test(name) || query.some(pair => /^download(?:=|$)/u.test(pair) || /^format=(?:csv|fits|json|text|tsv|txt|votable|xml)$/iu.test(pair) || FILE_ENDING.test(pair))) return true;
  // A page's own name overrules its folder: a meeting's `program.htm` sits in a `pdf` folder.
  return !/\.(?:s?html?|php|aspx?|jsp)$/iu.test(name) && (name === 'download' || name === 'file_downloaded' || DATA_PATH.test(path));
}
export function sourceDate(input: unknown, full = false): string {
  const value = sourceText(input);
  if (!(full ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/).test(value)) throw new TypeError('Invalid source date.');
  const [year, month = 1, day = 1] = value.split('-').map(Number), date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new TypeError('Impossible source date.');
  return value;
}
export function sourcePath(input: unknown): string {
  const path = sourceText(input);
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new TypeError('Invalid source record path.');
  return path;
}
export function sourceUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate source ${label}.`);
}
export function parseSourceEvidence(raw: unknown): SourceEvidence {
  if (sourceObject(raw).url !== undefined) {
    const value = sourceObject(raw, ['url','checkedOn','locator']);
    return Object.freeze({url:sourceUrl(value.url),checkedOn:sourceDate(value.checkedOn,true),locator:sourceText(value.locator)});
  }
  const value = sourceObject(raw, ['path', 'locator']), locator = sourceText(value.locator);
  if (!locator.startsWith('/')) throw new TypeError('Invalid source evidence locator.');
  return Object.freeze({ path: sourcePath(value.path), locator });
}
export function parseSourceBinding(raw: unknown, sources?: SourceResolver): SourceBinding {
  const value = sourceObject(raw), kind = sourceText(value.kind);
  if (kind === 'local') { sourceObject(raw, ['kind','reason']); return Object.freeze({ kind, reason: sourceText(value.reason) }); }
  if (kind === 'unresolved') {
    sourceObject(raw, ['kind','label','evidence','reason']);
    return Object.freeze({ kind, label: sourceText(value.label), evidence: sourceText(value.evidence), reason: sourceText(value.reason) });
  }
  if (kind !== 'catalogued') throw new TypeError('Unknown source binding.');
  sourceObject(raw, ['kind','references']);
  const references = sourceArray(value.references, raw => {
    const ref = sourceObject(raw, ['catalogueId','role','evidence','locator']), catalogueId = sourceId(ref.catalogueId);
    if (sources && !Object.hasOwn(sources, catalogueId)) throw new TypeError(`Unknown canonical source: ${catalogueId}.`);
    return Object.freeze({ catalogueId, role: sourceEnum(ref.role, ['material','method','reference','artwork']), evidence: sourceText(ref.evidence),
      ...(ref.locator === undefined ? {} : { locator: sourceText(ref.locator) }) });
  });
  if (!references.length) throw new TypeError('Empty source binding.');
  sourceUnique(references.map(ref => JSON.stringify(ref)), 'binding reference');
  return Object.freeze({ kind, references });
}
export function parseSourceCitation(raw: unknown, sources?: SourceResolver): SourceCitation {
  const value = sourceObject(raw, ['catalogueId','checkedOn','locator','evidence']), catalogueId = sourceId(value.catalogueId);
  if (sources && !Object.hasOwn(sources, catalogueId)) throw new TypeError(`Unknown citation source: ${catalogueId}.`);
  return Object.freeze({ catalogueId, checkedOn: sourceDate(value.checkedOn, true),
    ...(value.locator === undefined ? {} : { locator: sourceText(value.locator) }), ...(value.evidence === undefined ? {} : { evidence: sourceText(value.evidence) }) });
}
export function parseSourceCatalog(raw: unknown): SourceCatalog {
  const value = sourceObject(raw, ['schema','records']);
  if (value.schema !== SOURCE_CATALOG_SCHEMA) throw new TypeError('Unsupported source catalogue.');
  const records = sourceArray(value.records, raw => {
    const record = sourceObject(raw, ['id','kind','identityLevel','title','identifiers','links','evidence','creators','publisher','publicationDate','version','relations','statements']);
    const evidence = sourceArray(record.evidence, parseSourceEvidence);
    if (!evidence.length) throw new TypeError('Source identity needs evidence.');
    const identifiers = sourceArray(record.identifiers, raw => { const id = sourceObject(raw, ['type','value']); return Object.freeze({type: sourceText(id.type), value: sourceText(id.value)}); });
    sourceUnique(identifiers.map(id => `${id.type}:${id.value}`), 'provider identifier');
    const links = sourceArray(record.links, raw => { const link = sourceObject(raw, ['role','url','label']); return Object.freeze({role: sourceEnum(link.role, ['landing','archive','original','mirror','rights']), url: sourceUrl(link.url), label: sourceText(link.label)}); });
    sourceUnique(links.map(link => `${link.role}:${link.url}`), 'link');
    if (!links.some(link => link.role !== 'rights')) throw new TypeError('Source needs a citation link.');
    // The Sources tab sends its reader to this link (sourceCitationUrl). 9,983 of 16,476 records sent them to a download or a query address until 2026-10-12.
    const reader = sourceCitationUrl({ links });
    if (isFileAddress(reader)) throw new TypeError(`Source ${String(record.id)} sends its reader to a file, ${reader}. Add a landing link to the page that presents the file, and keep the file as its original link.`);
    const identityLevel = sourceEnum(record.identityLevel, ['work','release']);
    if (identityLevel === 'release' && record.version === undefined) throw new TypeError('A release needs its evidenced version.');
    const relations = sourceArray(record.relations, raw => { const relation = sourceObject(raw, ['kind','catalogueId','evidence']); return Object.freeze({ kind: sourceEnum(relation.kind, ['version-of','part-of','derived-from']), catalogueId: sourceId(relation.catalogueId), evidence: sourceText(relation.evidence) }); });
    const statements = sourceArray(record.statements, raw => { const statement = sourceObject(raw, ['kind','text','scope','evidence']); return Object.freeze({ kind: sourceEnum(statement.kind, ['credit','rights','limitation']), text: sourceText(statement.text), scope: sourceText(statement.scope), evidence: sourceText(statement.evidence) }); });
    return Object.freeze({ id: sourceId(record.id), kind: sourceEnum(record.kind, ['data-product','publication','model','reference-page','software','artwork']), identityLevel,
      title: sourceText(record.title), identifiers, links, evidence, relations, statements,
      ...(record.creators === undefined ? {} : {creators: sourceArray(record.creators, sourceText)}), ...(record.publisher === undefined ? {} : {publisher: sourceText(record.publisher)}),
      ...(record.publicationDate === undefined ? {} : {publicationDate: sourceDate(record.publicationDate)}), ...(record.version === undefined ? {} : {version: sourceText(record.version)}) });
  });
  sourceUnique(records.map(record => record.id), 'catalogue ID');
  const byId = Object.fromEntries(records.map(record => [record.id, record]));
  const identifiers = records.flatMap(record => record.identifiers.map(id => `${record.identityLevel}:${record.version ?? ''}:${id.type}:${id.value}`));
  sourceUnique(identifiers, 'canonical provider identity');
  for (const record of records) for (const relation of record.relations) {
    if (!Object.hasOwn(byId, relation.catalogueId) || relation.catalogueId === record.id) throw new TypeError('Invalid source relation.');
    if (relation.kind === 'version-of' && (record.identityLevel !== 'release' || byId[relation.catalogueId].identityLevel !== 'work')) throw new TypeError('Invalid source release relationship.');
  }
  const visit = (id: string, ancestors = new Set<string>()) => {
    if (ancestors.has(id)) throw new TypeError('Cyclic source relations.');
    for (const relation of byId[id].relations) visit(relation.catalogueId, new Set([...ancestors,id]));
  };
  records.forEach(record => visit(record.id));
  return Object.freeze({schema: SOURCE_CATALOG_SCHEMA, records});
}
export function sourceResolver(catalog: SourceCatalog): SourceResolver {
  return Object.freeze(Object.fromEntries(catalog.records.map(record => [record.id, record])));
}

/** The link a reader follows: the landing page, else the first citation link. The parser refuses a record where it is a file. */
export function sourceCitationUrl(source: Pick<SourceRecord, 'links'>): string { return (source.links.find(link => link.role === 'landing') ?? source.links.find(link => link.role !== 'rights'))!.url; }
