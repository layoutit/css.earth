/** Rewrite the drafted reader text and size facts of hosts and planets the archive route already made, after the templates change:
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --retext <host id>...
 *
 * Each host is drafted again from the NASA Exoplanet Archive (from-archive.mts), as if the universe held none of it, and only the
 * drafted fields are written back: the card and introduction with their archive locator in text.json, the stored spec and the
 * README's opening, and a planet's radius and mass facts in the units hosted.mts gives them. Orbits, lenses and every other file
 * stay as they are, so a template change is not a regeneration. Nothing is baked here (packages/bake/cli/prepare-object.mts does it). */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Archive } from './archives.mts';
import { archiveSpec } from './from-archive.mts';
import { EARTH_GM, JUPITER_GM, JUPITER_RADIUS_KM, sizeFacts } from './hosted.mts';
import { json } from './lens.mts';

interface DraftText { readonly card: string; readonly introduction: string; readonly locator: string }
const ARCHIVE_LOCATOR = 'NASA Exoplanet Archive';

/** Write `text` into the package `id` under `root`; returns the paths changed. */
async function writeText(root: string, id: string, text: DraftText, size?: { radiusJupiter: number; massJupiter: number }) {
  const o = resolve(root, 'src/objects', id), changed: string[] = [];
  const edit = async (path: string, change: (value: string) => string) => {
    const before = await readFile(resolve(o, path), 'utf8'), after = change(before);
    if (after !== before) { await writeFile(resolve(o, path), after); changed.push(path); }
  };
  const stored = JSON.parse(await readFile(resolve(o, 'source/preparation/new-object.json'), 'utf8')) as Record<string, any>;
  const entry = stored.planets?.[0] ?? stored, old = String(entry.text?.introduction ?? '');
  await edit('text.json', value => {
    const page = JSON.parse(value) as Record<string, any>;
    for (const key of ['card', 'introduction'] as const) {
      page[key].text = text[key];
      for (const source of page[key].sources ?? []) if (String(source.locator ?? '').startsWith(ARCHIVE_LOCATOR)) source.locator = text.locator;
    }
    return json(page);
  });
  await edit('source/preparation/new-object.json', value => {
    const spec = JSON.parse(value) as Record<string, any>, target = spec.planets?.[0] ?? spec;
    target.text = { ...target.text, card: text.card, introduction: text.introduction, locator: text.locator };
    return json(spec);
  });
  // The README opens with the drafted introduction, then its own sentences (hosted.mts, generate.mts).
  if (old) await edit('README.md', value => value.replace(old, text.introduction));
  if (size) await edit('source/content/object.json', value => {
    const content = JSON.parse(value) as { panel: { facts: { id: string; value: string }[] } };
    for (const fact of content.panel.facts) {
      const model = fact.value.endsWith(' (model)') ? ' (model)' : '';
      // A mass that is only an upper limit is recorded as GM 0; its limit is the fact's own value, in the unit it was written in.
      const limit = /^Under ([0-9.,]+) (Jupiter|Earth) masses/u.exec(fact.value);
      const mass = limit ? Number(limit[1]!.replaceAll(',', '')) / (limit[2] === 'Earth' ? JUPITER_GM / EARTH_GM : 1) : size.massJupiter;
      const { radiusValue, massValue } = sizeFacts(false, size.radiusJupiter, mass);
      if (fact.id === 'radius') fact.value = `${radiusValue}${model}`;
      if (fact.id === 'mass' && fact.value !== 'Not measured') fact.value = `${limit ? 'Under ' : ''}${massValue}${model}`;
    }
    return json(content);
  });
  return changed;
}

/** The archive-drafted planets of `hostId`, by name, from their stored specs. */
async function archivePlanets(root: string, hostId: string) {
  const planets = new Map<string, string>();
  for (const id of await readdir(resolve(root, 'src/objects'))) {
    const stored = await readFile(resolve(root, 'src/objects', id, 'source/preparation/new-object.json'), 'utf8').catch(() => undefined);
    if (!stored) continue;
    const spec = JSON.parse(stored) as { host?: string; planets?: { name: string; orbit?: { archive?: string } }[] };
    if (spec.host === hostId && spec.planets?.[0]?.orbit?.archive === 'nasa-ps') planets.set(spec.planets[0].name, id);
  }
  return planets;
}

export async function retextHosts(root: string, hostIds: readonly string[], archive: Archive, progress = (_line: string) => {}) {
  const lines: string[] = [];
  for (const hostId of hostIds) {
    const stored = JSON.parse(await readFile(resolve(root, 'src/objects', hostId, 'source/preparation/new-object.json'), 'utf8')) as { target?: string; name?: string; text?: { locator?: string } };
    const target = stored.target ?? stored.name;
    if (!target || !String(stored.text?.locator ?? '').startsWith(ARCHIVE_LOCATOR)) { lines.push(`${hostId}: not drafted from the archive; left as it is`); progress(lines.at(-1)!); continue; }
    let drafted;
    try { drafted = await archiveSpec(archive, target, { ids: new Set(), names: new Map(), stars: [] }); }
    catch (error) { lines.push(`${hostId}: ${(error as Error).message.split('\n')[0]}; left as it is`); progress(lines.at(-1)!); continue; }
    const changed = await writeText(root, hostId, (drafted.spec as { text: DraftText }).text);
    lines.push(`${hostId}: ${changed.join(', ') || 'unchanged'}`); progress(lines.at(-1)!);
    const packages = await archivePlanets(root, hostId);
    for (const planet of drafted.spec.planets as { name: string; text: DraftText }[]) {
      const id = packages.get(planet.name);
      if (!id) continue;
      const body = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), 'utf8')) as { physical: { meanRadiusKm: number; gravitationalParameterKm3PerS2: number } };
      const planetChanged = await writeText(root, id, planet.text, { radiusJupiter: body.physical.meanRadiusKm / JUPITER_RADIUS_KM, massJupiter: body.physical.gravitationalParameterKm3PerS2 / JUPITER_GM });
      lines.push(`${id}: ${planetChanged.join(', ') || 'unchanged'}`); progress(lines.at(-1)!);
    }
  }
  return lines;
}
