/** A generated planet's Charts tab, from what is published about it:
 *
 * - **Orbits.** Every planet of its star from above, to scale, from their hosted-orbit records (the `system-orbits` chart,
 *   @cssearth/bake/objects/charts): the orbits the app flies, so the chart and the scene cannot disagree.
 * - **Transmission and dayside emission spectra.** The NASA Exoplanet Archive's `transitspec` and `emissionspec` rows, each a
 *   paper's published depths by wavelength. One paper's rows make one chart (`measured-spectrum`): the paper with the most
 *   measured rows, the newest on a tie. Upper limits and rows without an error are left out, never filled. The archive's rows
 *   are kept beside the chart's record as served.
 *
 *   new-object --charts HOST_ID...     charts for the archive planets of hosts already in the tree
 *
 * or with every planet `--from-archive` generates. Nothing is baked here. */
import { MEASURED_SPECTRUM_SCHEMA } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Archive } from './archives.mts';
import { bindInputs, json, type PackageFiles } from './dataset.mts';
import { archiveRows, bestEphemeris, decodeEntities, ephemerisSigmaDays, NASA_TAP } from './orbit.mts';
import { installTransitChart, liveTessArchive, type Fold, type TessArchive } from './transit-chart.mts';

const SPECTRA = {
  transmission: { table: 'transitspec', depth: 'plntransdep', label: 'Transit depth (%)', titleKey: 'transmissionSpectrum', title: 'transmission spectrum',
    what: 'the fraction of starlight the planet blocks as it crosses its star, larger where its atmosphere absorbs' },
  emission: { table: 'emissionspec', depth: 'especlipdep', label: 'Eclipse depth (%)', titleKey: 'emissionSpectrum', title: 'dayside emission',
    what: "the light lost as the planet passes behind its star: its day side's own glow and reflected light" },
} as const;
type Spectrum = keyof typeof SPECTRA;
export const spectrumColumns = (kind: Spectrum) => `centralwavelng,bandwidth,${SPECTRA[kind].depth},${SPECTRA[kind].depth}err1,${SPECTRA[kind].depth}err2,${SPECTRA[kind].depth}lim,facility,instrument,${kind === 'transmission' ? 'plntranreflink' : 'plntreflink'}`;
const query = (kind: Spectrum, planet: string) => `select ${spectrumColumns(kind)} from ${SPECTRA[kind].table} where plntname='${planet.replace(/'/gu, "''")}' order by centralwavelng`;
export const spectrumUrl = (kind: Spectrum, planet: string) => `${NASA_TAP}?${new URLSearchParams({ query: query(kind, planet), format: 'csv' })}`;

const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));

export interface SpectrumRow { readonly x: number; readonly half: number; readonly y: number; readonly plus: number; readonly minus: number; readonly facility: string; readonly label: string; readonly url?: string; readonly year: number }

/** The measured rows of one archive spectrum table: depth with both errors, not a limit. */
export function parseSpectrumRows(kind: Spectrum, csv: string): SpectrumRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== spectrumColumns(kind)) throw new TypeError(`The NASA Exoplanet Archive ${SPECTRA[kind].table} answered with columns ${header}, not ${spectrumColumns(kind)}.`);
  return lines.filter(line => line.trim()).flatMap(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? NaN : Number(c[i]);
    const [x, width, y, plus, minus, limit] = [n(0), n(1), n(2), n(3), n(4), n(5)];
    if (![x, width, y, plus, minus].every(Number.isFinite) || limit === 1 || !(plus >= 0) || !(minus <= 0)) return [];
    const anchor = c[8] ?? '', label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1];
    return [{ x, half: width / 2, y, plus, minus: -minus, facility: `${c[6] ?? ''}${c[7] ? `, ${c[7]}` : ''}`, label, ...(url ? { url } : {}), year: Number(/(\d{4})\s*$/u.exec(label)?.[1] ?? 0) }];
  });
}

/** The paper whose rows the chart draws: the most measured rows, the newest on a tie; three rows at least. */
export function chosenPaper(rows: readonly SpectrumRow[]) {
  const papers = new Map<string, SpectrumRow[]>();
  for (const row of rows) papers.set(row.label, [...papers.get(row.label) ?? [], row]);
  const best = [...papers.values()].sort((a, b) => b.length - a.length || b[0]!.year - a[0]!.year)[0];
  return best && best.length >= 3 ? { rows: best, papers: papers.size } : undefined;
}

/** Round axis limits and three or four ticks that hold every bar and error, with a little room. */
export function niceAxis(low: number, high: number) {
  const pad = (high - low || Math.abs(high) || 1) * .08, a = low - pad, b = high + pad, raw = (b - a) / 3;
  const power = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(f => f * power).find(value => value >= raw)!;
  const minimum = Math.floor(a / step) * step, maximum = Math.ceil(b / step) * step, round = (value: number) => Number(value.toPrecision(12));
  const ticks: number[] = [];
  for (let value = minimum; value <= maximum + step / 2; value += step) ticks.push(round(value));
  return { minimum: round(minimum), maximum: round(maximum), ticks };
}

const short = (text: string, length = 52) => text.length <= length ? text : `${text.slice(0, length - 1)}…`;

/** Add the orbits chart and any archive spectra to a planet's package. `hostName` titles the orbits chart. */
/** The fold of planet `id` in these light-curve files, with the bake's own reader, fold and window: how many whole transits, the
 * dip's depth (the middle 60% of the transit below the baseline) and its standard error (the baseline's scatter over the in-transit
 * count), with the ephemeris moved by `shiftMinutes`. A planet the astronomy records do not hold, or files the reader refuses, fold
 * no transit. */
async function transitFold(id: string): Promise<Fold> {
  const { hostedOrbit } = await import('@cssearth/astronomy');
  return orbitFold(() => hostedOrbit(id as Parameters<typeof hostedOrbit>[0]));
}
/** The same fold on an orbit given directly: the draft folds a planet on the archive orbit it assembled, before any record exists. */
export async function orbitFold(orbitOf: () => { readonly periodDays: number; readonly transitTimeBmjdTdb: number }): Promise<Fold> {
  const { foldTransits, readTessLightCurve, transitWindow } = await import('@cssearth/bake/objects/raster');
  const read = (curves: readonly Buffer[]) => curves.map(bytes => readTessLightCurve(bytes)), none = { transits: 0, depthPpm: 0, errorPpm: Infinity };
  return {
    midBmjd(curves) { const times = read(curves).flatMap(curve => [curve.time[0]!, curve.time.at(-1)!]); return (Math.min(...times) + Math.max(...times)) / 2; },
    measure(curves, durationHours, shiftMinutes) {
      try {
        const base = orbitOf(), orbit = { ...base, transitTimeBmjdTdb: base.transitTimeBmjdTdb + shiftMinutes / 1440 }, window = transitWindow(durationHours);
        const folded = foldTransits(read(curves), orbit, window), inside: number[] = [], outside: number[] = [];
        folded.time.forEach((time, i) => { const offset = Math.abs(time - orbit.transitTimeBmjdTdb); if (offset < 0.3 * durationHours / 24) inside.push(folded.flux[i]!); else if (offset > window.outsideDays) outside.push(folded.flux[i]!); });
        if (inside.length < 3 || outside.length < 3) return none;
        const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length, level = mean(outside);
        const scatter = Math.sqrt(outside.reduce((sum, value) => sum + (value - level) ** 2, 0) / (outside.length - 1));
        return { transits: folded.transits, depthPpm: (level - mean(inside)) * 1e6, errorPpm: scatter / Math.sqrt(inside.length) * 1e6 };
      } catch { return none; }
    },
  };
}

/** The uncertainty of the ephemeris the orbit took (orbit.mts bestEphemeris, the same rows) at a date, or undefined when no row gives
 * its errors. */
export async function timingSigma(archive: Archive, name: string) {
  const best = bestEphemeris(await archiveRows(archive, name).catch(() => []));
  return best ? (epochBjd: number) => ephemerisSigmaDays(best.row, epochBjd) : undefined;
}

/** Whether the archive lists a transmission or emission spectrum of planet `name` with three measured bins from one paper. */
export async function hasArchiveSpectrum(archive: Archive, name: string) {
  for (const kind of Object.keys(SPECTRA) as Spectrum[]) if (chosenPaper(parseSpectrumRows(kind, await archive.text(spectrumUrl(kind, name))))) return true;
  return false;
}

/** `archiveName` is the name the archive's tables know the planet by, when it still lists it by a survey number (TOI-1203.01 for
 * TOI-1203 d): every table is asked by it, and `name` titles the charts. */
export async function installPlanetCharts(files: PackageFiles, id: string, name: string, host: { id: string; name: string }, archive: Archive, tess?: TessArchive, archiveName = name) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const measurements = read(`${s}/measurements.json`), orbitUrl = String(read(`${s}/content/object.json`).panel.facts.find((fact: { id: string }) => fact.id === 'period')?.source?.url ?? '');
  const orbits = { kind: 'system-orbits', id: `${id}-orbits`, title: `${name}: orbits around ${host.name}`, output: `${id}-system-orbits.svg`, system: host.id, highlight: id,
    description: `The orbits of ${host.name}'s planets in this map from above, to scale, with ${name} highlighted and the direction to Earth down. Each orbit is the one the app draws, from the published period, a/R*, eccentricity and argument of periastron; the star is a marker, not to scale.`,
    metadata: { orbitSource: String(measurements.orbitalPeriodSource ?? '') } };
  const charts: Record<string, unknown>[] = [orbits], controls: Record<string, unknown>[] = [{ id: orbits.id, titleKey: 'systemOrbits', src: `/scenes/${id}/${orbits.output}`, alt: orbits.description,
    source: { id: `${id}-observational-measurements`, path: '../manifest.json', url: orbitUrl } }];
  const inputs: Record<string, unknown>[] = [], operations: Record<string, unknown>[] = [], report: string[] = [], drawn: string[] = [];
  for (const kind of Object.keys(SPECTRA) as Spectrum[]) {
    const spec = SPECTRA[kind], url = spectrumUrl(kind, archiveName), csv = await archive.text(url), chosen = chosenPaper(parseSpectrumRows(kind, csv));
    if (!chosen) { report.push(`${id}: no ${spec.title} with three measured rows in the archive's ${spec.table}`); continue; }
    // A paper may combine several facilities; each is named, in the order its rows first use it.
    const rows = chosen.rows, first = rows[0]!, facilities = [...new Set(rows.map(row => row.facility))].join('; '), path = `science/archive-spectra/${kind}`, chartId = `${id}-${kind}`;
    files.set(`${s}/${path}.csv`, csv);
    files.set(`${s}/${path}.json`, json({ schema: MEASURED_SPECTRUM_SCHEMA, source: `NASA Exoplanet Archive ${spec.table}, ${first.label}`, units: { x: 'um', y: '%' },
      uncertainty: 'published 1-sigma, asymmetric (err1, err2)', observation: facilities,
      measurements: rows.map(row => ({ x: row.x, xLow: Number((row.x - row.half).toPrecision(12)), xHigh: Number((row.x + row.half).toPrecision(12)), y: row.y, minus: row.minus, plus: row.plus })) }));
    const x = niceAxis(Math.min(...rows.map(r => r.x - r.half)), Math.max(...rows.map(r => r.x + r.half))), y = niceAxis(Math.min(...rows.map(r => r.y - r.minus)), Math.max(...rows.map(r => r.y + r.plus)));
    const description = `${name}'s ${spec.title}: ${spec.what}. ${rows.length} measured bins from ${first.label} (${facilities}), as the NASA Exoplanet Archive lists them. Horizontal bars are wavelength bins; vertical bars are the published 1-sigma errors.${chosen.papers > 1 ? ` The archive holds ${chosen.papers - 1} other paper${chosen.papers > 2 ? 's' : ''} for this planet; this chart draws the one with the most bins.` : ''}`;
    charts.push({ kind: 'measured-spectrum', id: chartId, title: `${name}: ${spec.title}`, description, output: `${chartId}.svg`,
      metadata: { publication: first.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', table: spec.table, bins: rows.length },
      source: { path: `${path}.json`, format: 'records', yScale: 1, expectedRows: rows.length }, mode: 'points',
      x: { label: 'Wavelength (µm)', ...x }, y: { label: spec.label, ...y },
      notes: [short(first.label), short(facilities), 'Bars: wavelength bins and 1σ errors.', 'Values as the NASA Exoplanet Archive lists them.'] });
    controls.push({ id: chartId, titleKey: spec.titleKey, src: `/scenes/${id}/${chartId}.svg`, alt: description, source: { id: `${id}-archive-${kind}`, path: '../manifest.json', url: first.url ?? url } });
    inputs.push({ id: `${id}-archive-${kind}`, path: `${path}.json`, origin: first.url ?? url, credit: `${first.label}, via the NASA Exoplanet Archive ${spec.table} table`, license: 'Factual numerical measurements; source attribution retained',
      acquisition: `The measured rows of ${first.label} in the archive's ${spec.table} table (${path}.csv), written as published: no limits, no filled errors`, redistribution: 'Factual parameter transcription only', consumers: ['charts'],
      sourceBinding: { kind: 'local', reason: `Transcribed from ${path}.csv, the archive's rows as served; the generator rewrites both.` } },
    { id: `${id}-archive-${kind}-rows`, path: `${path}.csv`, origin: url, credit: `NASA Exoplanet Archive, ${spec.table} table`, license: 'NASA Exoplanet Archive data use: acknowledge the archive and the papers it cites',
      acquisition: `TAP query in source/preparation/acquisition.json: every ${spec.table} row of ${name}.`, redistribution: 'Table rows as served, with the archive acknowledged.', consumers: ['charts'] });
    operations.push({ kind: 'download', groups: ['restore', 'refresh'], path: `${path}.csv`, url });
    report.push(`${id}: ${spec.title} from ${first.label}, ${rows.length} bins${chosen.papers > 1 ? ` (of ${chosen.papers} papers)` : ''}`);
    drawn.push(`its ${spec.title}, ${rows.length} bins from ${first.label} in the archive's ${spec.table} table${chosen.papers > 1 ? `, the most of its ${chosen.papers} papers` : ''}`);
  }
  // The transit as TESS recorded it (transit-chart.mts), after the spectra.
  const transit = await installTransitChart(files, id, name, archive, tess ?? await liveTessArchive(), await transitFold(id), await timingSigma(archive, archiveName), archiveName);
  report.push(transit.report);
  if (transit.recipe) { charts.push(transit.recipe); controls.push(transit.control); inputs.push(...transit.inputs); operations.push(...transit.operations); drawn.push(transit.readme); }
  files.set(`${s}/content/charts.json`, json({ schema: 'cssearth-chart-assets@1', publicBase: `/scenes/${id}/`, charts }));
  const content = read(`${s}/content/object.json`);
  content.charts = controls;
  files.set(`${s}/content/object.json`, json(content));
  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...manifest.inputs.filter((input: { id: string }) => !String(input.id).startsWith(`${id}-archive-`) && !String(input.id).startsWith(`${id}-tess-sector-`)), ...inputs];
  manifest.documents = [...(manifest.documents ?? []).filter((document: { path: string }) => document.path !== 'content/charts.json'),
    { path: 'content/charts.json', sourceBinding: { kind: 'local', reason: 'Prepared chart recipes: the orbits drawn from the hosted-orbit records, and archive spectra with their units, errors and source paths.' } }];
  files.set(`${s}/manifest.json`, json(manifest));
  // The archive rows are bound to their own catalogue record, as a planet's emission-table rows are (dataset.mts).
  bindInputs(files, id);
  const plan = read(`${s}/preparation/acquisition.json`);
  plan.operations = [...plan.operations.filter((operation: { path?: string }) => !/^(science\/archive-spectra|photometry\/tess)\//u.test(String(operation.path ?? ''))), ...operations];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  // The README, the package's source record, says what each chart draws; a rerun replaces its paragraph.
  const readme = `**Charts.** The orbits of ${host.name}'s planets from above, from their hosted-orbit records${drawn.length ? `, and ${drawn.join('; ')}` : ''}. Upper limits and rows without an error are left out.`;
  const page = files.get(`${o}/README.md`);
  if (typeof page === 'string') files.set(`${o}/README.md`, page.includes('**Charts.**') ? page.replace(/\*\*Charts\.\*\*[^\n]*/u, readme) : page.replace('## Evidence', `${readme}\n\n## Evidence`));
  return report;
}

/** `--charts HOST_ID...`: the archive planets of hosts already in the tree get their charts; nothing is baked. */
export async function chartHosts(root: string, hostIds: readonly string[], archive: Archive, progress = (_line: string) => {}) {
  const { readdir, mkdir, rm, writeFile } = await import('node:fs/promises'), { dirname } = await import('node:path');
  const lines: string[] = [], paths = ['README.md', 'source/measurements.json', 'source/content/object.json', 'source/manifest.json', 'source/preparation/acquisition.json'];
  for (const hostId of hostIds) {
    const host = JSON.parse(await readFile(resolve(root, 'src/objects', hostId, 'source/content/object.json'), 'utf8')) as { displayName: string };
    for (const id of await readdir(resolve(root, 'src/objects'))) {
      const stored = await readFile(resolve(root, 'src/objects', id, 'source/preparation/new-object.json'), 'utf8').catch(() => undefined);
      const spec = stored ? JSON.parse(stored) as { host?: string; planets?: { name: string; orbit?: { archive?: string; planetName?: string } }[] } : undefined;
      if (spec?.host !== hostId || spec.planets?.[0]?.orbit?.archive !== 'nasa-ps') continue;
      const files: PackageFiles = new Map();
      for (const path of paths) files.set(`src/objects/${id}/${path}`, await readFile(resolve(root, 'src/objects', id, path), 'utf8'));
      const report = await installPlanetCharts(files, id, spec.planets[0].name, { id: hostId, name: host.displayName }, archive, undefined, spec.planets[0].orbit?.planetName);
      // Light curves a planet no longer charts (the gate refused it) are not left for the manifest check to find undeclared.
      const tess = resolve(root, 'src/objects', id, 'source/photometry/tess');
      for (const name of await readdir(tess).catch(() => [] as string[])) if (!files.has(`src/objects/${id}/source/photometry/tess/${name}`)) await rm(resolve(tess, name));
      for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
      lines.push(`${id}: orbits${report.length ? `; ${report.join('; ').replaceAll(`${id}: `, '')}` : ''}`); progress(lines.at(-1)!);
    }
  }
  return lines;
}
