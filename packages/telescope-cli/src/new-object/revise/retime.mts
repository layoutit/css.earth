/** Rewrite the orbit timing of planets the archive route already made, after the ephemeris rule changes (orbit.mts: the period and
 * transit time from one row, the one that predicts EPHEMERIS_EPOCH_BJD best):
 *
 *   node packages/telescope-cli/src/new-object/new-object-cli.mts --retime <host id>...
 *
 * Each archive planet's rows are read again and its orbit assembled as a draft would; only the period, the transit time and their
 * two source lines are written back, to the astronomy record, the measurements, the Year fact and the README. The shape, datasets and
 * every other file stay as they are. Nothing is baked here. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Archive } from '../archives/archives.mts';
import { json } from '../dataset.mts';
import { archiveRows, assembleArchiveOrbit, compositeMass } from '../planets/orbit.mts';

/** The Year fact as hosted.mts writes it. */
const yearValue = (period: number) => period < 2 ? `${Math.round(period * 24)} hours` : period < 1000 ? `${Number(period.toPrecision(3))} days` : `${Math.round(period / 365.25)} years`;

export async function retimeHosts(root: string, hostIds: readonly string[], archive: Archive, progress = (_line: string) => {}) {
  const lines: string[] = [], hosts = new Set(hostIds);
  for (const id of await readdir(resolve(root, 'src/objects'))) {
    const stored = await readFile(resolve(root, 'src/objects', id, 'source/preparation/new-object.json'), 'utf8').catch(() => undefined);
    const spec = stored ? JSON.parse(stored) as { host?: string; planets?: { name: string; orbit?: { archive?: string; reference?: string; planetName?: string; measured?: true } }[] } : undefined;
    const planet = spec?.planets?.[0];
    if (!spec?.host || !hosts.has(spec.host) || planet?.orbit?.archive !== 'nasa-ps' || planet.orbit.measured) continue;
    const name = planet.orbit.planetName ?? planet.name, rows = await archiveRows(archive, name);
    const { orbit } = assembleArchiveOrbit(rows, planet.orbit.reference, await compositeMass(archive, name));
    const bodyPath = resolve(root, 'packages/astronomy/data/bodies', `${id}.json`), body = JSON.parse(await readFile(bodyPath, 'utf8')) as { hostedOrbit: Record<string, any> };
    const was = body.hostedOrbit, sources = was.sources as Record<string, string>;
    if (was.periodDays === orbit.periodDays && was.transitTimeBmjdTdb === orbit.transitTimeBmjdTdb && sources.period === orbit.sources.period && sources.phase === orbit.sources.phase) {
      lines.push(`${id}: timing unchanged`); progress(lines.at(-1)!); continue;
    }
    const replacements: [string, string][] = [[sources.period!, orbit.sources.period!], [sources.phase!, orbit.sources.phase!]];
    body.hostedOrbit = { ...was, periodDays: orbit.periodDays, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb, sources: { ...sources, period: orbit.sources.period, phase: orbit.sources.phase } };
    await writeFile(bodyPath, json(body));
    const o = resolve(root, 'src/objects', id);
    const measurements = JSON.parse(await readFile(resolve(o, 'source/measurements.json'), 'utf8')) as Record<string, unknown>;
    if (measurements.orbitalPeriodDays !== undefined) measurements.orbitalPeriodDays = orbit.periodDays;
    if (typeof measurements.orbitalPeriodSource === 'string') measurements.orbitalPeriodSource = String(measurements.orbitalPeriodSource).replace(sources.period!, orbit.sources.period!);
    await writeFile(resolve(o, 'source/measurements.json'), json(measurements));
    const content = JSON.parse(await readFile(resolve(o, 'source/content/object.json'), 'utf8')) as { panel: { facts: { id: string; value: string }[] } };
    for (const fact of content.panel.facts) if (fact.id === 'period') fact.value = yearValue(orbit.periodDays);
    await writeFile(resolve(o, 'source/content/object.json'), json(content));
    const readme = await readFile(resolve(o, 'README.md'), 'utf8');
    await writeFile(resolve(o, 'README.md'), replacements.reduce((text, [from, to]) => from ? text.replaceAll(from, to) : text, readme));
    // How far the transit moves at the comparison epoch: the new ephemeris's prediction minus the old one's.
    const at = 2461041.5 - 2400000.5, predict = (t0: number, p: number) => t0 + Math.round((at - t0) / p) * p;
    const shift = (predict(orbit.transitTimeBmjdTdb, orbit.periodDays) - predict(was.transitTimeBmjdTdb, was.periodDays)) * 1440;
    lines.push(`${id}: P ${was.periodDays} → ${orbit.periodDays} d; transit at 2026-01-01 moves ${Math.round(shift)} min`); progress(lines.at(-1)!);
  }
  return lines;
}
