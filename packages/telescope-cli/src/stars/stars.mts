/** Star survey for the telescope API: which single stars of a galaxy a paper has measured one by one.
 *
 * SIMBAD is asked for every object inside the galaxy's catalogued outline, counted by object type. The stars are grouped
 * into classes by SIMBAD's own type tree (its `otypedef` table), and each class names the papers its stars come from.
 * VizieR is then asked, by bibcode, whether it holds each paper's tables, and each table is read for what a placed star
 * needs: a position of its own and a period or a temperature. Nothing is downloaded and no star is made here. A table the
 * survey calls ready is a lead for `new-object --from-table`, and so is one that lists each star by its detector pixel, once its
 * paper has said which exposure the pixels are of. The single stars of no class that SIMBAD holds there with no parallax and no
 * proper motion are named too, the most cited first: a star a paper studied alone is often typed a plain star. Last, the papers
 * API (papers.mts, OpenAlex) is asked for the works whose title or abstract names the galaxy and a kind of star, the newest first:
 * SIMBAD and VizieR take months to hold a new paper, and a paper they never took in is found only there; a star SIMBAD lists inside the outline may still be a
 * foreground star of the Milky Way, which only its paper says. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SIMBAD_TAP } from '../new-object/companions.mts';
import { parseSimbadTsv, simbadQuoted as quoted, simbadTsvForm } from '../new-object/archives/tables/simbad-tap.mts';
import { VIZIER_ASU } from '../new-object/archives/archives.mts';
import { DECIMAL_POSITION, parseVizierMeta, starColumns, vizierDataRows, type StarColumns } from '../new-object/archives/tables/vizier-tables.mts';
import { displayName, OPENALEX_WORKS, parseOpenAlexResponse } from '../papers.mts';
import { loadTargetCatalogue } from '../query.mts';

export const STARS_SCHEMA = 'cssearth-telescope-stars@1';
const REQUEST_TIMEOUT_MS = 60_000;
const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** Papers named per class, and rows read from a table to see whether its positions are each star's own. */
const PAPERS_PER_CLASS = 4, ROWS_SAMPLED = 3;
/** Stars outside every class named for the reader, when at least this many papers cite them. */
const OTHERS_NAMED = 8, OTHERS_PAPERS = 2;
/** Works the papers API is asked for and named, and the words that make a work one about single stars. */
const WORKS_ASKED = 100, WORKS_NAMED = 10;
export const STAR_WORDS = ['Cepheid', 'Cepheids', 'supergiant', 'supergiants', 'hypergiant', 'luminous blue variable', 'Wolf-Rayet', 'Mira', 'Miras', 'RR Lyrae', 'early-type star', 'massive star'];

/** The star classes the survey reports, each by the root of its branch in SIMBAD's type tree. `route` names the
 * `new-object --from-table` class that drafts such a star from a table row; a class without one is counted only. */
export const STAR_CLASSES = [
  { id: 'cepheid', label: 'Cepheids', roots: ['Ce*'], route: 'cepheid' },
  { id: 'type-ii-cepheid', label: 'Type II Cepheids', roots: ['WV*'] },
  { id: 'rr-lyrae', label: 'RR Lyrae stars', roots: ['RR*'] },
  { id: 'long-period', label: 'Miras and long-period variables', roots: ['LP*', 'Mi*'] },
  // SIMBAD's tree puts the Wolf-Rayet stars on the supergiants' branch.
  { id: 'supergiant', label: 'Supergiants and Wolf-Rayet stars', roots: ['sg*'] },
] as const satisfies readonly { readonly id: string; readonly label: string; readonly roots: readonly string[]; readonly route?: string }[];
/** Counted for the reader and never placed: an outburst or a remnant, not a star with a size. */
const TRANSIENTS = [{ one: 'nova', label: 'novae', roots: ['No*'] }, { one: 'supernova', label: 'supernovae', roots: ['SN*'] }, { one: 'X-ray binary', label: 'X-ray binaries', roots: ['XB*'] },
  { one: 'planetary nebula', label: 'planetary nebulae', roots: ['PN'] }] as const;

export interface SimbadType { readonly otype: string; readonly path: readonly string[]; readonly candidate: boolean }
export interface StarTable { readonly name: string; readonly rows: number | null; readonly columns: StarColumns;
  /** Whether the rows read each have a position of their own; false when every row repeats one (a galaxy's centre) or the table has none. */
  readonly ownPositions: boolean }
export interface StarPaper { readonly bibcode: string; readonly title: string; readonly stars: number; readonly url: string;
  /** VizieR's tables of the paper that carry a period or a temperature; null when VizieR holds no table of the paper. */
  readonly catalogue: { readonly name: string; readonly tables: readonly StarTable[] } | null }
export interface StarLead { readonly class: string; readonly bibcode: string; readonly table: string; readonly positions: 'table' | 'simbad' | 'pixel'; readonly command: string }
export interface StarSurvey {
  readonly schema: typeof STARS_SCHEMA; readonly target: { readonly id: string; readonly name: string };
  readonly simbad: { readonly name: string; readonly raDeg: number; readonly decDeg: number; readonly majorAxisArcmin: number; readonly radiusDeg: number };
  /** Every SIMBAD object inside the outline, and those of them on the star branch of its type tree, the kinds listed under `transients` left out. */
  readonly objects: number; readonly stars: number;
  readonly classes: readonly { readonly id: string; readonly label: string; readonly count: number; readonly papers: readonly StarPaper[] }[];
  readonly transients: readonly { readonly one: string; readonly label: string; readonly count: number }[];
  readonly leads: readonly StarLead[];
  /** Single stars of no class above that SIMBAD holds inside the outline with no parallax and no proper motion, so not plainly in front of
   * the galaxy, the most cited first: M51-DS1 is typed a plain star. Each is a lead for a spec written by hand from its paper. */
  readonly others: readonly { readonly name: string; readonly otype: string; readonly papers: number }[];
  /** Works whose title or abstract names the galaxy and a kind of star (STAR_WORDS), from the papers API: those whose title names the kind of star first, each group
   * the newest first; `worksIssue` when it did not answer. */
  readonly works: readonly { readonly year: number | null; readonly title: string; readonly doi: string | null }[]; readonly worksIssue?: string;
}

/** Every way a paper writes a catalogue name: "NGC 4303" and "NGC4303", "M 61" and "M61". */
export const spellings = (names: readonly string[]): string[] => [...new Set(names.flatMap(name => { const match = /^(NGC|IC|M|Messier|UGC|ESO)\s*([\d-]+[A-Z]?)$/iu.exec(name.trim()); return match ? [`${match[1]} ${match[2]}`, `${match[1]}${match[2]}`] : [name.trim()]; }))];
/** The papers API request: works naming the galaxy by any spelling and a kind of star, the newest first. */
export function starWorksQuery(names: readonly string[]): string {
  const phrases = (values: readonly string[]) => `(${values.map(value => `"${value.replace(/[,:|*"()]/gu, ' ').trim()}"`).join(' OR ')})`;
  return `${OPENALEX_WORKS}?${new URLSearchParams({ filter: `title_and_abstract.search:${phrases(spellings(names))} AND ${phrases(STAR_WORDS)},type:article|review|preprint|letter`, 'per-page': String(WORKS_ASKED), sort: 'publication_year:desc',
    select: 'id,doi,title,display_name,publication_year,type,authorships,open_access,best_oa_location,primary_location,relevance_score,abstract_inverted_index' })}`;
}

/** SIMBAD's type tree: each type with its path from the root ("* > Ev* > Ce* > cC*"). */
export function parseSimbadTypes(rows: readonly Record<string, string>[]): SimbadType[] {
  return rows.map(row => ({ otype: row.otype ?? '', path: (row.path ?? '').split('>').map(step => step.trim()).filter(Boolean), candidate: row.is_candidate === '1' }));
}
/** The confirmed types on the branches of `roots`. */
export const typesUnder = (types: readonly SimbadType[], roots: readonly string[]): string[] =>
  types.filter(type => !type.candidate && type.path.some(step => roots.includes(step))).map(type => type.otype);

const circle = (raDeg: number, decDeg: number, radiusDeg: number) => `CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg.toFixed(5)})) = 1`;
export const simbadQueries = {
  galaxy: (name: string) => `SELECT b.main_id, b.ra, b.dec, b.galdim_majaxis FROM basic AS b JOIN ident AS n ON b.oid = n.oidref WHERE n.id = ${quoted(name)}`,
  types: () => 'SELECT otype, path, is_candidate FROM otypedef',
  counts: (raDeg: number, decDeg: number, radiusDeg: number) => `SELECT otype, COUNT(*) AS n FROM basic WHERE ${circle(raDeg, decDeg, radiusDeg)} GROUP BY otype`,
  others: (raDeg: number, decDeg: number, radiusDeg: number, otypes: readonly string[]) => `SELECT TOP ${OTHERS_NAMED} b.main_id, b.otype, b.nbref FROM basic AS b WHERE ${circle(raDeg, decDeg, radiusDeg).replace('ra, dec', 'b.ra, b.dec')} AND b.plx_value IS NULL AND b.pmra IS NULL AND b.nbref >= ${OTHERS_PAPERS} AND b.otype IN (${otypes.map(quoted).join(', ')}) ORDER BY nbref DESC`,
  papers: (raDeg: number, decDeg: number, radiusDeg: number, otypes: readonly string[]) => `SELECT TOP ${PAPERS_PER_CLASS} r.bibcode, r.title, COUNT(*) AS n FROM basic AS b JOIN has_ref AS h ON h.oidref = b.oid JOIN ref AS r ON r.oidbib = h.oidbibref WHERE ${circle(raDeg, decDeg, radiusDeg).replace('ra, dec', 'b.ra, b.dec')} AND b.otype IN (${otypes.map(quoted).join(', ')}) GROUP BY r.bibcode, r.title ORDER BY n DESC`,
};

export interface StarSurveyOptions { readonly target: string; readonly directory?: string; readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch;
  /** The target catalogue, when the caller has read it already (it is every object package's descriptor). */
  readonly catalogue?: Awaited<ReturnType<typeof loadTargetCatalogue>> }

export async function surveyStars(root: string, options: StarSurveyOptions): Promise<StarSurvey> {
  const fetcher = options.fetcher ?? fetch, progress = options.progress ?? (() => undefined);
  const read = async (url: string, what: string) => {
    const response = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${what} returned HTTP ${response.status} for ${url}.`);
    return response.text();
  };
  const simbad = async (query: string) => parseSimbadTsv(await read(`${SIMBAD_TAP}?${new URLSearchParams(simbadTsvForm(query))}`, 'SIMBAD'), query);
  const vizier = (form: Readonly<Record<string, string>>) => read(`${VIZIER_ASU}?${new URLSearchParams(form)}`, 'VizieR');

  const catalogue = options.catalogue ?? await loadTargetCatalogue(root), target = displayName(options.target, catalogue);
  const names = [target.name, ...catalogue.find(entry => entry.id === target.id)?.aliases ?? []];
  progress(`Asking SIMBAD where ${target.name} is…`);
  let galaxy: Record<string, string> | undefined;
  for (const name of names) if ((galaxy = (await simbad(simbadQueries.galaxy(name)))[0])) break;
  if (!galaxy) throw new Error(`SIMBAD knows no object named ${names.join(' or ')}.`);
  const raDeg = Number(galaxy.ra), decDeg = Number(galaxy.dec), majorAxisArcmin = Number(galaxy.galdim_majaxis);
  if (!(majorAxisArcmin > 0) || !Number.isFinite(raDeg) || !Number.isFinite(decDeg))
    throw new Error(`SIMBAD gives ${galaxy.main_id} no outline (basic.galdim_majaxis is ${galaxy.galdim_majaxis || 'empty'}), so the survey has no region to search; it surveys galaxies.`);
  const radiusDeg = majorAxisArcmin / 120;

  progress(`Counting SIMBAD's objects within ${majorAxisArcmin.toFixed(1)}′ of ${galaxy.main_id}…`);
  const types = parseSimbadTypes(await simbad(simbadQueries.types())), counts = new Map((await simbad(simbadQueries.counts(raDeg, decDeg, radiusDeg))).map(row => [row.otype ?? '', Number(row.n)]));
  const count = (roots: readonly string[]) => typesUnder(types, roots).reduce((sum, otype) => sum + (counts.get(otype) ?? 0), 0);
  const papers = new Map<string, StarPaper['catalogue']>(), classes: StarSurvey['classes'][number][] = [], leads: StarLead[] = [];
  for (const starClass of STAR_CLASSES) {
    const otypes = typesUnder(types, starClass.roots).filter(otype => counts.has(otype)), found: StarPaper[] = [];
    if (otypes.length) {
      progress(`Reading the papers behind its ${starClass.label.toLowerCase()}…`);
      for (const row of await simbad(simbadQueries.papers(raDeg, decDeg, radiusDeg, otypes))) {
        const bibcode = row.bibcode ?? '';
        if (!papers.has(bibcode)) {
          const held = parseVizierMeta(await vizier({ '-source': bibcode, '-meta.all': '' }), bibcode), tables: StarTable[] = [];
          for (const table of held?.tables ?? []) {
            const columns = starColumns(table);
            if (!columns.period && !columns.temperature) continue;
            const sample = columns.position ? vizierDataRows(await vizier({ '-source': table.name, '-out': `${DECIMAL_POSITION.ra},${DECIMAL_POSITION.dec}`, '-out.max': String(ROWS_SAMPLED) }), table.name) : [];
            tables.push({ name: table.name, rows: table.rows, columns, ownPositions: new Set(sample.map(cells => `${cells[DECIMAL_POSITION.ra]} ${cells[DECIMAL_POSITION.dec]}`)).size > 1 });
          }
          papers.set(bibcode, held ? { name: held.name, tables } : null);
        }
        found.push({ bibcode, title: row.title ?? '', stars: Number(row.n), url: `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(bibcode)}`, catalogue: papers.get(bibcode)! });
      }
    }
    classes.push({ id: starClass.id, label: starClass.label, count: count(starClass.roots), papers: found });
    // A table is a lead when it has a period and a place for each star: its own, SIMBAD's through the name CDS added to each row, or a detector pixel.
    if ('route' in starClass) for (const paper of found) for (const table of paper.catalogue?.tables ?? []) if (table.columns.period && (table.ownPositions || table.columns.simbadName || table.columns.pixel) && !leads.some(lead => lead.table === table.name)) {
      const positions = table.ownPositions ? 'table' : table.columns.simbadName ? 'simbad' : 'pixel';
      leads.push({ class: starClass.id, bibcode: paper.bibcode, table: table.name, positions, command: `telescope new-object --from-table ${starClass.route}:${target.id}=${table.name}${positions === 'pixel' ? '#exposure=mast:HST/product/FILE.fits,firstPixel=N' : ''} --out SPEC.json` });
    }
  }
  // Every confirmed star type that is neither a class above nor an outburst or remnant, as far as SIMBAD counts any here.
  const named = new Set([...STAR_CLASSES, ...TRANSIENTS].flatMap(kind => typesUnder(types, kind.roots))), plain = typesUnder(types, ['*']).filter(otype => !named.has(otype) && counts.has(otype));
  if (plain.length) progress('Reading the other single stars SIMBAD holds there…');
  const others = plain.length ? (await simbad(simbadQueries.others(raDeg, decDeg, radiusDeg, plain))).map(row => ({ name: (row.main_id ?? '').replace(/\s+/gu, ' '), otype: row.otype ?? '', papers: Number(row.nbref) })) : [];
  // OpenAlex stems and matches loosely ("M 82" in any language): a work is kept when its own words name the galaxy and a kind of star.
  progress('Asking the papers API for works that name it with a kind of star…');
  let works: StarSurvey['works'] = [], worksIssue: string | undefined;
  try {
    const found = parseOpenAlexResponse(JSON.parse(await read(starWorksQuery(names), 'OpenAlex'))), named = new RegExp(spellings(names).map(name => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s*')).join('|'), 'iu');
    const starry = new RegExp(STAR_WORDS.map(word => word.replace(/[- ]/gu, '[- ]')).join('|'), 'iu'), seen = new Set<string>();
    const kept = found.filter(work => { const text = `${work.title} ${work.abstract}`, key = work.title.toLowerCase(); return named.test(text) && starry.test(text) && /galax|stellar|\bstars?\b/iu.test(text) && !seen.has(key) && !!seen.add(key); });
    // A paper about a star says so in its title; one that mentions a kind of star in passing comes after.
    works = [...kept.filter(work => starry.test(work.title)), ...kept.filter(work => !starry.test(work.title))].slice(0, WORKS_NAMED).map(work => ({ year: work.year, title: work.title, doi: work.doi }));
  } catch (error) { worksIssue = (error as Error).message; }
  const result: StarSurvey = { schema: STARS_SCHEMA, target, simbad: { name: (galaxy.main_id ?? '').replace(/\s+/gu, ' '), raDeg, decDeg, majorAxisArcmin, radiusDeg },
    objects: [...counts.values()].reduce((sum, n) => sum + n, 0), stars: count(['*']) - TRANSIENTS.reduce((sum, kind) => sum + count(kind.roots), 0),
    classes, transients: TRANSIENTS.map(kind => ({ one: kind.one, label: kind.label, count: count(kind.roots) })), leads, others, works, ...(worksIssue ? { worksIssue } : {}) };
  if (options.directory) { await mkdir(options.directory, { recursive: true }); await writeFile(resolve(options.directory, 'stars.json'), `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

const tableWords = (table: StarTable) => [`${table.rows ?? 'unknown'} rows`, table.columns.period ? `period (${table.columns.period.column})` : '', table.columns.temperature ? `temperature (${table.columns.temperature})` : '',
  table.ownPositions ? 'a position per star' : table.columns.position ? 'one position for every row, not each star\'s' : 'no position', !table.ownPositions && table.columns.simbadName ? `a SIMBAD name per row (${table.columns.simbadName})` : '',
  table.columns.pixel ? `a detector pixel per star (${[table.columns.pixel.chip, table.columns.pixel.x, table.columns.pixel.y].filter(Boolean).join(', ')})` : ''].filter(Boolean).join(', ');

export function formatStars(result: StarSurvey, directory?: string): string {
  const many = (n: number) => n.toLocaleString('en-US');
  const lines = [`${result.target.name} · ${many(result.stars)} stars among ${many(result.objects)} SIMBAD objects within ${result.simbad.majorAxisArcmin.toFixed(1)}′ of ${result.simbad.name}`, ''];
  for (const starClass of result.classes) {
    lines.push(`${starClass.label}: ${many(starClass.count)}`);
    for (const paper of starClass.papers) {
      lines.push(`  ${String(paper.stars).padStart(5)}  ${paper.bibcode}  ${paper.title}`);
      if (!paper.catalogue) lines.push('         VizieR holds no table of this paper.');
      else if (!paper.catalogue.tables.length) lines.push(`         VizieR ${paper.catalogue.name}: no period or temperature column.`);
      else for (const table of paper.catalogue.tables) lines.push(`         VizieR ${table.name}: ${tableWords(table)}`);
    }
  }
  const seen = result.transients.filter(kind => kind.count);
  if (seen.length) lines.push('', `Not stars to place: ${seen.map(kind => `${many(kind.count)} ${kind.count === 1 ? kind.one : kind.label}`).join(', ')}.`);
  lines.push('');
  if (!result.leads.length) lines.push('No table gives a star of a class the generator drafts both a period and a place.');
  for (const lead of result.leads) lines.push(lead.positions === 'table' ? `Ready: ${lead.command}`
    : lead.positions === 'simbad' ? `Ready, placed by SIMBAD (the table gives each row a SIMBAD name and no position): ${lead.command}`
    : `Placed by pixel, once the paper says which exposure its pixels are of and how its software counts them (FILE, N): ${lead.command}`);
  if (result.others.length) lines.push('', `Other single stars SIMBAD holds here with no parallax or proper motion, most cited first: ${result.others.map(star => `${star.name} (${star.otype}, ${star.papers} papers)`).join('; ')}.`,
    'One whose paper prints a temperature and a luminosity can be drafted by hand (spec.mts).');
  if (result.works.length) lines.push('', 'Works that name it with a kind of star (papers API), the star in the title first, each newest first:', ...result.works.map(work => `  ${work.year ?? '    '}  ${work.title}${work.doi ? `  ${work.doi}` : ''}`));
  if (result.worksIssue) lines.push('', `The papers API did not answer (${result.worksIssue}); run \`telescope papers\` for it later.`);
  lines.push('', 'A lead is not a star: read the paper, and check a star is in the galaxy and not in front of it.');
  if (directory) lines.push('', `Saved: ${resolve(directory, 'stars.json')}`);
  return `${lines.join('\n')}\n`;
}
