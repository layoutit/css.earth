import { isRecord as record } from '@cssearth/core';

export const paperSchema = 'cssearth-messier-papers@1';
export const paperRoot = '.local/nebula-lab/catalogue/messier/papers';
export const paperEndpoint = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
export interface Paper {
  bibcode: string; title: string; year: number | null; journal: string | null;
  doi: string | null; abstract: string | null; objectNames: string | null;
}
export interface PaperPage {
  schema: typeof paperSchema; objectId: string; simbadId: string; retrievedAt: string;
  query: string; sourceSha256: string; expectedCount: number; papers: Paper[];
}
export interface PaperReference {
  objectId: string; simbadId: string; expectedCount: number; count: number;
  status: 'complete' | 'partial' | 'pending' | 'error'; error?: string;
  path?: string; sha256?: string; bytes?: number;
}
export interface PaperIndex {
  schema: 'cssearth-messier-paper-index@1'; catalogueSha256: string; generatedAt: string;
  countQuery: string; countSourceSha256: string; objects: PaperReference[];
}
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string';
const nullableText = (v: unknown): v is string | null => v === null || text(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const date = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const id = (v: unknown): v is string => text(v) && /^m(?:[1-9]|[1-9]\d|10\d|110)$/.test(v);
const matchesId = (a: string, b: string) => a === b.toLowerCase().replace(/\s/g, '');

export function readPaper(value: unknown): Paper {
  if (!record(value) || !text(value.bibcode) || !/^\d{4}\S{15}$/.test(value.bibcode) || !text(value.title) ||
    !(value.year === null || count(value.year) && value.year >= 1500 && value.year <= 2200) ||
    !nullableText(value.journal) || !nullableText(value.doi) || !nullableText(value.abstract) || !nullableText(value.objectNames)) throw new TypeError('Invalid paper metadata.');
  return {bibcode:value.bibcode,title:value.title,year:value.year,journal:value.journal,doi:value.doi,abstract:value.abstract,objectNames:value.objectNames};
}
export function readPaperPage(value: unknown): PaperPage {
  if (!record(value) || value.schema !== paperSchema || !id(value.objectId) || !text(value.simbadId) || !matchesId(value.objectId,value.simbadId) ||
    !date(value.retrievedAt) || !text(value.query) || !hash(value.sourceSha256) || !count(value.expectedCount) || !Array.isArray(value.papers)) throw new TypeError('Invalid paper page.');
  const papers = value.papers.map(readPaper);
  if (new Set(papers.map(p => p.bibcode)).size !== papers.length) throw new TypeError('Duplicate papers.');
  return {schema:paperSchema,objectId:value.objectId,simbadId:value.simbadId,retrievedAt:value.retrievedAt,query:value.query,sourceSha256:value.sourceSha256,expectedCount:value.expectedCount,papers};
}
export function readPaperIndex(value: unknown): PaperIndex {
  if (!record(value) || value.schema !== 'cssearth-messier-paper-index@1' || !hash(value.catalogueSha256) || !date(value.generatedAt) ||
    !text(value.countQuery) || !hash(value.countSourceSha256) || !Array.isArray(value.objects) || value.objects.length !== 110) throw new TypeError('Invalid paper index.');
  const objects = value.objects.map((o): PaperReference => {
    if (!record(o) || !id(o.objectId) || !text(o.simbadId) || !matchesId(o.objectId,o.simbadId) || !count(o.expectedCount) || !count(o.count) ||
      !(o.status === 'complete' || o.status === 'partial' || o.status === 'pending' || o.status === 'error') || o.error !== undefined && !text(o.error)) throw new TypeError('Invalid paper reference.');
    if (o.path !== undefined && (o.path !== `${paperRoot}/${o.objectId}-${o.sha256}.json.gzip` || !hash(o.sha256) || !count(o.bytes) || !o.bytes)) throw new TypeError('Invalid paper artifact.');
    if ((o.status === 'complete' || o.status === 'partial') && !o.path || o.status === 'complete' && o.count !== o.expectedCount) throw new TypeError('Incomplete paper reference.');
    return {objectId:o.objectId,simbadId:o.simbadId,expectedCount:o.expectedCount,count:o.count,
      status:o.status,...(text(o.error)?{error:o.error}:{}),
      ...(text(o.path)&&hash(o.sha256)&&count(o.bytes)?{path:o.path,sha256:o.sha256,bytes:o.bytes}:{})};
  });
  if (new Set(objects.map(o=>o.objectId)).size !== 110) throw new TypeError('Duplicate paper targets.');
  return {schema:'cssearth-messier-paper-index@1',catalogueSha256:value.catalogueSha256,generatedAt:value.generatedAt,countQuery:value.countQuery,countSourceSha256:value.countSourceSha256,objects};
}
