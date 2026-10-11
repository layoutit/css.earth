/** Write the facts each star's record gives into its page's factsheet, for stars already in the tree:
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --facts --all | <star id>... [--papers]
 *
 * For every star (a package whose source/measurements.json is a uniform-disc star) this copies the mass its body record
 * states into the measurements record, then adds to `panel.facts` of source/content/object.json the facts star-facts.mts
 * derives: mass, surface temperature, luminosity, spectral type, age and day. Only records and content change, and nothing
 * is baked. `node packages/bake/cli/prepare-factsheets.mts` then republishes the changed factsheets. Run again, the pass
 * changes nothing: a fact a page lists is never replaced.
 *
 * `--papers` first makes the source record of each paper a value's sentence names and the catalogue does not hold, as the
 * generator makes a paper's record (archives.mts fetchPublication, publication-record.mts). A paper the catalogue holds
 * under another address is found by its DOI or arXiv number, and its record gains the bibcode the sentence cites it by.
 * Without `--papers` nothing is fetched. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { UNIFORM_DISC_STAR_SCHEMA } from '@cssearth/objects';
import { fetchPublication, type Archive } from '../archives/archives.mts';
import { CHECKED } from '../color.mts';
import { json } from '../dataset.mts';
import { publicationRecord } from '../publication-record.mts';
import { addressesIn, identitiesOf, indexRecord, isPaper, recordedMass, sameAddress, sourceIndex, starFacts, STAR_FACTS, withFields, type SourceIndex } from './star-facts.mts';

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8').catch(() => 'null')) as unknown;
/** Papers asked of the archives at once. */
const AT_ONCE = 4;

interface Star { readonly id: string; readonly recordPath: string; readonly contentPath: string; readonly record: Record<string, unknown>; readonly content: Record<string, unknown> & { panel: Record<string, unknown> & { facts: unknown[] } }; readonly listed: ReadonlySet<string> }

/** The record of the paper at `address`: the catalogue's own when it holds the paper under another address, else a new
 * record written to src/sources. Returns whether the address now leads to a record. */
async function paperRecord(root: string, archive: Archive, index: SourceIndex, address: string): Promise<boolean> {
  const publication = await fetchPublication(archive, address).catch(() => undefined);
  if (!publication || publication.page || publication.wikipedia) return false;
  const made = publicationRecord(publication), held = identitiesOf(made).map(identity => index.byIdentity.get(identity)).find(Boolean) ?? (index.byId.has(made.id) ? made.id : undefined);
  if (!held) { const record = indexRecord(index, made, CHECKED); if (!record) return false; await writeFile(resolve(root, 'src/sources', `${made.id}.json`), json(made)); return true; }
  // The catalogue holds the paper without the bibcode the sentence cites it by: the record gains it, so the address leads
  // to it from now on with nothing fetched.
  const path = resolve(root, 'src/sources', `${held}.json`), existing = await readJson(path), bibcode = publication.bibcode;
  if (!isRecord(existing) || !bibcode) return false;
  const next = identitiesOf(existing).some(identity => identity.endsWith(`:${bibcode.toLowerCase()}`)) ? existing
    : { ...existing, identifiers: [...(Array.isArray(existing.identifiers) ? existing.identifiers as unknown[] : []), { type: 'bibliography-key', value: bibcode }] };
  if (next !== existing) await writeFile(path, json(next));
  return indexRecord(index, next, CHECKED) !== undefined && index.byAddress.has(sameAddress(address));
}

/** Writes the records and factsheets; returns one line a changed star and a last line of counts. */
export async function writeStarFacts(root: string, ids: readonly string[], report: (line: string) => void = () => undefined, archive?: Archive): Promise<string[]> {
  const sources = resolve(root, 'src/sources'), index = sourceIndex(await Promise.all((await readdir(sources)).filter(name => name.endsWith('.json')).map(name => readJson(resolve(sources, name)))), CHECKED);
  const stars: Star[] = []; let masses = 0;
  for (const id of ids.length ? ids : (await readdir(resolve(root, 'src/objects'))).sort()) {
    const recordPath = resolve(root, 'src/objects', id, 'source/measurements.json'), contentPath = resolve(root, 'src/objects', id, 'source/content/object.json');
    const held = await readJson(recordPath), content = await readJson(contentPath);
    if (!isRecord(held) || held.schema !== UNIFORM_DISC_STAR_SCHEMA || !isRecord(content) || !isRecord(content.panel) || !Array.isArray(content.panel.facts)) { if (ids.length) throw new Error(`${id} is not a star with a measurements record and a factsheet.`); continue; }
    const mass = recordedMass(await readJson(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`))), record = mass ? withFields(held, mass) : held;
    if (json(record) !== json(held)) { await writeFile(recordPath, json(record)); masses++; }
    const listed = new Set((content.panel.facts as unknown[]).concat(Array.isArray(content.panel.moreFacts) ? content.panel.moreFacts as unknown[] : []).flatMap(fact => isRecord(fact) && typeof fact.id === 'string' ? [fact.id] : []));
    stars.push({ id, recordPath, contentPath, record, content: content as Star['content'], listed });
  }
  let papers = 0, refused = 0;
  if (archive) {
    // Each paper once: the first address of a sentence that leads to no record.
    const wanted = [...new Set(stars.flatMap(star => starFacts(star.id, star.record, star.listed, index).uncited.flatMap(({ sentence }) => addressesIn(sentence).filter(isPaper).slice(0, 1))).map(sameAddress))];
    report(`${wanted.length} papers the catalogue holds no record under their address.`);
    let next = 0;
    await Promise.all(Array.from({ length: AT_ONCE }, async () => { while (next < wanted.length) { const address = wanted[next++]!; if (await paperRecord(root, archive, index, address)) papers++; else { refused++; report(`no record: ${address}`); } } }));
  }
  const lines: string[] = [], written = new Map<string, number>(), uncited = new Map<string, number>(); let contradicted = 0;
  for (const star of stars) {
    const found = starFacts(star.id, star.record, star.listed, index);
    for (const { field } of found.uncited) uncited.set(field, (uncited.get(field) ?? 0) + 1);
    if (found.contradicted) contradicted++;
    if (!found.facts.length) continue;
    for (const fact of found.facts) written.set(fact.id, (written.get(fact.id) ?? 0) + 1);
    await writeFile(star.contentPath, json({ ...star.content, panel: { ...star.content.panel, facts: [...star.content.panel.facts, ...found.facts] } }));
    lines.push(`${star.id}: ${found.facts.map(fact => fact.id).join(', ')}`); report(lines.at(-1)!);
  }
  lines.push(`${stars.length} stars; mass copied into ${masses} records${archive ? `; ${papers} papers given a record or found under another address, ${refused} not` : ''}. Facts added: ${STAR_FACTS.map(fact => `${fact.id} ${written.get(fact.id) ?? 0}`).join(', ')}. ` +
    `Left out for want of a record to cite: ${STAR_FACTS.map(fact => `${fact.field} ${uncited.get(fact.field) ?? 0}`).join(', ')}. Days held back because the catalogued periods contradict them: ${contradicted}.`);
  return lines;
}
