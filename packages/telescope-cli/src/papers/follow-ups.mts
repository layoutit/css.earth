/** What was published about a paper after it: the notices printed under its own title, and the later works that cite it and
 * name the target. A paper's numbers are not used before these are read.
 *
 * A publisher prints an erratum under the paper's title, alone (Astronomy & Astrophysics) or quoted after "Erratum:" (the AAS
 * journals), as a work with its own DOI. Neither OpenAlex nor Crossref links the two for older papers: for Comerón et al.
 * (2003, doi 10.1051/0004-6361:20021909) and its erratum (doi 10.1051/0004-6361:20030311) OpenAlex holds two articles with one
 * title and Crossref no `update-to` relation (checked 2026-10-04). So the notices are found by title, through Crossref, which
 * does not meter requests. What the other work is, the reader decides by opening it. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { OpenAlexWork } from './works.mts';

export const CROSSREF_WORKS = 'https://api.crossref.org/works';
/** Later works named under one paper. */
export const LATER_NAMED = 5;
/** A notice's title is the paper's with at most this many more characters ("Erratum:", a journal reference in brackets). */
const NOTICE_MARGIN = 60;

export interface SameTitleWork { readonly doi: string; readonly year: number | null; readonly type: string; readonly title: string }
export interface LaterWork { readonly year: number | null; readonly title: string; readonly doi: string | null }

export const sameTitleQuery = (title: string): string => `${CROSSREF_WORKS}?${new URLSearchParams({ 'query.bibliographic': title, rows: '6', select: 'DOI,title,type,issued' })}`;

const letters = (value: string): string => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const doiOf = (value: string): string => value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '').toLowerCase();

/** The other works Crossref holds under a paper's title: the same words, a different DOI, and not the preprint. */
export function sameTitleWorks(response: unknown, work: { readonly title: string; readonly doi: string | null }): SameTitleWork[] {
  const items = requireArray(requireRecord(requireRecord(response, 'Crossref response').message, 'Crossref response message').items, 'Crossref response items');
  const wanted = letters(work.title), own = work.doi ? doiOf(work.doi) : '';
  return items.flatMap((entry, index) => {
    const item = requireRecord(entry, `Crossref item ${index + 1}`), doi = requireString(item.DOI, `Crossref item ${index + 1} DOI`), type = requireString(item.type, `Crossref item ${index + 1} type`);
    const title = String(requireArray(item.title ?? [], `Crossref item ${index + 1} title`)[0] ?? '').replace(/\s+/gu, ' ').trim(), found = letters(title);
    if (!wanted || doiOf(doi) === own || type === 'posted-content' || !found.includes(wanted) || found.length > wanted.length + NOTICE_MARGIN) return [];
    const issued = item.issued === undefined ? undefined : requireRecord(item.issued, `Crossref item ${index + 1} issued`)['date-parts'];
    const year = Array.isArray(issued) && Array.isArray(issued[0]) && typeof issued[0][0] === 'number' ? issued[0][0] : null;
    return [{ doi: `https://doi.org/${doi}`, year, type, title }];
  });
}

/** The later works that cite one paper, the newest first: `citing` is the answer to `citingQuery`, kept to the works that name
 * the target. OpenAlex holds some works twice, under two DOIs; a title is named once. */
export function laterWorks(citing: readonly OpenAlexWork[], id: string): LaterWork[] {
  const seen = new Set<string>();
  return citing.filter(work => work.id !== id && work.references.includes(id) && !seen.has(letters(work.title)) && !!seen.add(letters(work.title)))
    .map(work => ({ year: work.year, title: work.title, doi: work.doi }));
}
