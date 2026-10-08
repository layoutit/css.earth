/** Which leads a page has already read, for the leads: a lead its investigation ledger settles is not offered again.
 *
 * A body's `investigations.json` records what was examined for it and what was decided: a paper whose fit became a dataset is
 * `included`, one that prints too little to draw is `excluded` with the reason, one waiting on something is `deferred`. A lead
 * is read when an entry's evidence or finding names its DOI or its arXiv number. A paper the package only cites for a radius
 * or an orbit is not thereby read for its phase curve, so the README and the manifest are not searched: to settle a lead,
 * write its entry. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseInvestigationLedger, type InvestigationStatus } from '@cssearth/objects';

export interface ReadMark { readonly status: InvestigationStatus; /** The ledger entry that settles the lead. */ readonly entry: string }

const DOI = /10\.\d{4,9}\/[^\s"<>]+/giu, ARXIV = /arxiv(?:\.org\/(?:abs|pdf)\/|[.:]\s?)(\d{4}\.\d{4,5})/giu;
/** The DOIs and arXiv numbers a text names, as keys: a DOI in lower case without closing punctuation, `arxiv:2503.12521`. */
export function identifiers(text: string): string[] {
  const dois = [...text.matchAll(DOI)].map(match => match[0].toLowerCase().replace(/[).,;\]]+$/u, ''));
  return [...new Set([...dois, ...dois.flatMap(doi => /^10\.48550\/arxiv\.(\d{4}\.\d{4,5})/u.exec(doi)?.[1] ?? []).map(id => `arxiv:${id}`), ...[...text.matchAll(ARXIV)].map(match => `arxiv:${match[1]}`)])];
}

/** The identifiers a page's ledger names, each with the entry that names it. A body without a ledger has read nothing. */
export async function readMarks(root: string, id: string): Promise<Map<string, ReadMark>> {
  const marks = new Map<string, ReadMark>(), path = resolve(root, 'src/objects', id, 'investigations.json');
  const text = await readFile(path, 'utf8').catch((error: unknown) => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; });
  if (text === undefined) return marks;
  for (const entry of parseInvestigationLedger(JSON.parse(text) as unknown, id).entries)
    for (const key of identifiers([entry.finding, ...entry.evidence].join(' '))) if (!marks.has(key)) marks.set(key, { status: entry.status, entry: entry.id });
  return marks;
}

/** The mark of a lead by its DOI, when the ledger names it. */
export const markOf = (doi: string, marks: ReadonlyMap<string, ReadMark>): ReadMark | undefined => identifiers(doi).map(key => marks.get(key)).find(Boolean);
