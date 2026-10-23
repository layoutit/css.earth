import type { PaperReport, PaperSearch, PaperSweep } from '../papers.mts';
import type { Lead, LeadSearch } from '../simulations/leads.mts';
import type { StarSurvey } from '../stars/stars.mts';
import type { ListSpec } from './list.mts';
import { openExternal } from './open.mts';
import { bold, dim, wrap } from './style.mts';
import { shellWord } from '../cli/cli-format.mts';

interface ListOptions { readonly directory?: string; readonly noOpen?: boolean }
type Opener = (url: string) => void;
type PaperRow = Pick<PaperReport, 'title' | 'year' | 'doi'> &
  Partial<Pick<PaperReport, 'authors' | 'moreAuthors' | 'arxiv' | 'openAccessUrl' | 'openAlex' | 'evidence' | 'access' | 'captions'>> &
  { readonly target: string };
type StarRow = StarSurvey['classes'][number];
const number = (value: number) => value.toLocaleString('en-US');
const authors = (work: PaperRow) => `${work.authors?.[0] ?? '—'}${(work.authors?.length ?? 0) > 1 || work.moreAuthors ? ' et al.' : ''}`;
const opened = (url: string | undefined | null, noOpen: boolean | undefined, open: Opener, missing: string) => {
  if (!url) return missing;
  if (noOpen) return 'not opened (--no-open)';
  open(url);
  return `opened ${url}`;
};

export function papersList(data: PaperSearch | PaperSweep, options: ListOptions = {}, open: Opener = openExternal): ListSpec<PaperRow> {
  const targets = 'targets' in data ? data.targets : [data];
  const name = targets.map(entry => entry.target.name).join(', ');
  const rows: PaperRow[] = targets.flatMap(entry => entry.works.map(work => ({ ...work, target: entry.target.name })));
  const source = [...new Set(targets.map(entry => entry.source))].join(', ');
  const names = targets.map(entry => shellWord(entry.target.name)).join(' ');
  return {
    crumbs: ['telescope', 'papers', name],
    title: `${bold(name)} · ${rows.length} papers ${dim(`· from ${source} · most mentions first`)}`,
    rows,
    columns: [
      { head: 'Year', width: 4, get: work => String(work.year ?? '') },
      { head: 'Title', width: 46, get: work => work.title },
      { head: 'First author', width: 18, get: authors },
      { head: 'Mentions', width: 8, get: work => String(work.evidence ?? 0).padStart(5) },
    ],
    text: work => `${work.year} ${work.title} ${(work.authors ?? []).join(' ')} ${(work.captions ?? []).map(caption => caption.text).join(' ')}`,
    panel: (work, width) => {
      const byline = `${(work.authors ?? []).join(', ')}${work.moreAuthors ? ' et al.' : ''} · ${work.year}`;
      return [...wrap(work.title, width, 3).map(bold), dim(byline.length > width ? `${byline.slice(0, width - 1)}…` : byline), '',
        dim(`names ${work.target} ${work.evidence ?? 0} times · ${work.access?.status === 'fetchable' ? 'full text readable' : work.access?.status ?? ''}`), '',
        ...(work.captions?.length ? [dim('Figures about it'), ...work.captions.slice(0, 2).flatMap(caption => wrap(caption.text, width, 2))] : [dim('no figure captions about it')])];
    },
    enter: { label: 'open', run: work => opened(work.arxiv ?? work.doi ?? work.openAccessUrl ?? work.openAlex, options.noOpen, open, 'no paper to open') },
    plain: work => `${work.year}  ${work.title}  ${authors(work)}  ${work.doi ?? ''}`,
    footer: options.directory ? `Saved: ${options.directory}/papers.json` : `Nothing saved. Keep this list with: telescope papers ${names} --out DIRECTORY`,
  };
}

export function leadsList(data: LeadSearch, options: ListOptions = {}, open: Opener = openExternal): ListSpec<Lead> {
  return {
    crumbs: ['telescope', 'leads', data.target.name],
    title: `${bold(data.target.name)} · ${data.leads.length} published data and papers ${dim('· from DataCite and arXiv')}`,
    rows: data.leads,
    columns: [
      { head: 'Year', width: 4, get: lead => String(lead.year ?? '') },
      { head: 'Kind', width: 6, get: lead => lead.kind },
      { head: 'Title', width: 48, get: lead => lead.title },
      { head: 'Where', width: 14, get: lead => lead.publisher },
    ],
    text: lead => `${lead.year} ${lead.kind} ${lead.title} ${lead.publisher} ${lead.description} ${lead.class}`,
    panel: (lead, width) => [...wrap(lead.title, width, 3).map(bold),
      dim(`${lead.kind} · ${lead.publisher} · ${lead.year ?? ''}${lead.license ? ` · ${lead.license}` : ''}`), '',
      ...wrap(lead.description.replace(/<[^>]+>/gu, ''), width, 8), '', dim(lead.url ?? lead.doi)],
    enter: { label: 'open', run: lead => opened(lead.url || `https://doi.org/${lead.doi}`, options.noOpen, open, 'no record to open') },
    plain: lead => `${lead.year}  ${lead.kind}  ${lead.title}  ${lead.url ?? lead.doi}`,
    ...(options.directory ? { footer: `Saved: ${options.directory}/leads.json` } : {}),
  };
}

export function starsList(data: StarSurvey, options: ListOptions = {}, open: Opener = openExternal): ListSpec<StarRow> {
  return {
    crumbs: ['telescope', 'stars', data.target.name],
    title: `${bold(data.target.name)} · ${number(data.stars)} stars of ${number(data.objects)} objects in SIMBAD ${dim(`· radius ${data.simbad.radiusDeg.toFixed(1)}°`)}`,
    rows: [...data.classes, ...data.transients.map(row => ({ id: row.one, label: row.label, count: row.count, papers: [] }))],
    columns: [
      { head: 'Kind of star', width: 26, get: row => row.label },
      { head: 'Count', width: 8, get: row => number(row.count).padStart(8) },
      { head: 'Main catalogue', width: 36, get: row => row.papers[0]?.title ?? '—' },
    ],
    text: row => `${row.label} ${row.papers.map(paper => paper.title).join(' ')}`,
    panel: (row, width) => {
      const tables = data.leads.filter(lead => lead.class === row.id);
      return [bold(row.label), dim(`${number(row.count)} in SIMBAD`), '',
        ...(row.papers.length ? row.papers.slice(0, 3).flatMap(paper => [...wrap(paper.title, width, 2), dim(`${number(paper.stars)} stars · ${paper.bibcode}`), '']) : [dim('no catalogue paper listed'), '']),
        ...(tables.length ? [dim(`${tables.length} catalogue table${tables.length > 1 ? 's' : ''} with positions`)] : [])];
    },
    enter: { label: 'open its paper', run: row => opened(row.papers[0]?.url, options.noOpen, open, 'no paper to open') },
    plain: row => `${row.label}  ${row.count}  ${row.papers[0]?.bibcode ?? ''}`,
    ...(options.directory ? { footer: `Saved: ${options.directory}/stars.json` } : {}),
  };
}
