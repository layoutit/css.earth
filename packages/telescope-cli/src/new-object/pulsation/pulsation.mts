/** `telescope new-object` for a pulsating star's light through one cycle: draft a spec from the star pages whose package
 * keeps a published light-curve model, and the route (maps/route.mts) that writes the cycle as the steps of one dataset
 * group on each star's page and bakes the star. pulsation-steps.mts holds the records.
 *
 * The model is the star's own source file: the Gaia DR3 `vari_cepheid` row its acquisition plan restores
 * (`photometry/gaia-dr3-vari-cepheid.csv`, light-curve.mts). A star whose package declares none has no steps: nothing is
 * fitted here to a star no published model covers. A page that plays the same model over its disc (the Light curves
 * switch) is told which datasets are stills of it, so the played light is not drawn over them a second time. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { checkGaiaCepheidModel, gaiaCepheidClass, parseGaiaCepheidRow } from '@cssearth/bake/photometry';
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { GAIA_TAP, type Archive } from '../archives/archives.mts';
import { gaiaCepheidForm, installLightCurveRow } from '../light-curve.mts';
import { readJson, type MapRoute, type RouteContext } from '../maps/route.mts';
import type { SurfaceMapChoice } from '../maps/surface-maps.mts';
import { PHASES, phaseChoice, PULSATION_GROUP, PULSATION_MODEL_CONSUMER, PULSATION_STEPS, pulsationStep, type PulsationStep } from './pulsation-steps.mts';

/** The star's published light-curve model under its `source/`, as light-curve.mts installs it. */
export const PULSATION_MODEL = 'photometry/gaia-dr3-vari-cepheid.csv';
const NOTE = '../../../docs/pulsating-stars-light-through-a-cycle.md', LEAD = '**Pulsation.**';
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
const restore = (host: string) => `node packages/bake/cli/restore-source-inputs.mts --object=${host}`;

/** The star's archived row, read and held to its own published values. */
async function modelOf(root: string, host: string) {
  const csv = await readFile(resolve(root, 'src/objects', host, 'source', PULSATION_MODEL), 'utf8').catch(() => { throw new Error(`${host}: its Gaia DR3 vari_cepheid row is not in the checkout (${restore(host)}).`); });
  const where = `${host}: ${PULSATION_MODEL}`, model = parseGaiaCepheidRow(csv, where);
  return { model, check: checkGaiaCepheidModel(model, where) };
}
const presentationOf = async (root: string, host: string) => requireRecord(await readJson(resolve(root, 'src/objects', host, 'source/preparation/presentation.json'), `${host}: no presentation profile`), `${host} presentation profile`);

async function reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<PulsationStep> {
  const { model, check } = await modelOf(root, host), content = requireRecord(await readJson(resolve(root, 'src/objects', host, 'source/content/object.json'), `${host}: no such page`), `${host} content`);
  return pulsationStep(choice, { host, name: requireString(content.displayName, `${host} display name`), played: isRecord((await presentationOf(root, host)).lightCurve) }, model, check);
}

/** A README with `text` as the last paragraph of `section`, before the next section or the links that close the file. A README without the section is left as it is. */
function atEndOf(readme: string, section: string, text: string): string {
  const head = new RegExp(`^## ${section}\\s*$`, 'mu').exec(readme); if (!head) return readme;
  const from = head.index + head[0].length, rest = readme.slice(from), next = /^(?:## |\[Investigation ledger\])/mu.exec(rest), end = from + (next ? next.index : rest.length);
  return `${readme.slice(0, end).trimEnd()}\n\n${text}\n${next ? '\n' : ''}${readme.slice(end)}`;
}
/** The star's README with what its Pulsation steps are and what they leave out, in the sections it already has. Written
 * again, the paragraphs are replaced, not added. */
export function withPulsationReadme(readme: string, step: PulsationStep, tied?: string): string {
  const kept = readme.split('\n\n').filter(paragraph => !paragraph.trimStart().replace(/^- /u, '').startsWith(LEAD)).join('\n\n'), shares = step.shares.map(share => `${(100 * share).toFixed(0)}`).join(', ');
  const paragraphs: readonly (readonly [string, string])[] = [
    ['Sources', `${LEAD} The ${PHASES} steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light (vari_cepheid, source ${step.sourceId}: ${step.harmonics === 1 ? 'one harmonic' : `${step.harmonics} harmonics`} of a ${step.periodDays.toFixed(step.periodDays < 10 ? 3 : 2)}-day period; the same row as [the source record](../../sources/gaia-dr3-vari-cepheid-${step.host}.json)), evaluated in this project a tenth of a period apart, from maximum light ([method note](${NOTE})).${tied ? ` ${tied}` : ''} Each step draws the star's color dimmed to that phase's share of its light at maximum: ${shares}%.`],
    ['Known problems', `- ${LEAD} The steps show the light alone. The star's color and its size change through the cycle and are not drawn: no published calibration found turns Gaia's two colors into a Cepheid's temperature, and nothing here measures this star's size through the cycle. ${PHASES} steps a tenth of a period apart are a display choice; the model between them is continuous.`]];
  return paragraphs.reduce((text, [section, paragraph]) => atEndOf(text, section, paragraph), kept);
}

/** The presentation profile of a page that plays its light curve, naming the step group whose datasets are stills of it. */
export function withStills(profile: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return isRecord(profile.lightCurve) ? { ...profile, lightCurve: { model: profile.lightCurve.model, stills: PULSATION_GROUP } } : { ...profile };
}

async function starRecords(root: string, host: string, steps: readonly PulsationStep[]): Promise<Map<string, string>> {
  const out = new Map<string, string>(), first = steps[0]; if (!first) return out;
  const profilePath = `src/objects/${host}/source/preparation/presentation.json`; out.set(profilePath, `${JSON.stringify(withStills(await presentationOf(root, host)), null, 2)}\n`);
  const readmePath = `src/objects/${host}/README.md`, readme = await readFile(resolve(root, readmePath), 'utf8').catch(() => undefined);
  // A row tied to the star by its place says so where it was acquired: the README repeats it.
  const manifest: unknown = await readFile(resolve(root, 'src/objects', host, 'source/manifest.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
  const row = isRecord(manifest) && Array.isArray(manifest.inputs) ? manifest.inputs.filter(isRecord).find(input => input.path === PULSATION_MODEL) : undefined, how = typeof row?.acquisition === 'string' ? row.acquisition : '';
  if (readme !== undefined) out.set(readmePath, withPulsationReadme(readme, first, how.includes(TIED) ? how.slice(how.indexOf(TIED)) : undefined));
  return out;
}

export const PULSATION_ROUTE: MapRoute<PulsationStep> = { kind: PULSATION_STEPS, specKey: 'pulsations', name: 'pulsation steps', reduced,
  // The steps are bound to records the star's package already has: its own row's and Gaia DR3's.
  sourceRecords: () => new Map(), starRecords };

/** A star whose package names no Gaia source (a Cepheid of another galaxy, placed by its paper's table) is tied to its row
 * of Gaia's table by its place and its period. Both limits are this repository's, and each can only leave a star without
 * steps: the one Gaia DR3 Cepheid within `AT_PLACE_ARCSEC` of the page's place (the radius the generator already takes
 * for "the star at this place", archives/gravity.mts), whose period is within `SAME_PERIOD` of the one the package's own
 * catalogue row prints, so the model and the page describe one pulsation. */
export const AT_PLACE_ARCSEC = 1, SAME_PERIOD = 0.01;
const CATALOGUE_ROW = 'photometry/catalogue-row.tsv', TIED = 'Tied to the star by its place:';
export const cepheidsAtForm = (raDegrees: number, decDegrees: number): Record<string, string> => ({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv',
  QUERY: `SELECT c.source_id, DISTANCE(POINT('ICRS', g.ra, g.dec), POINT('ICRS', ${raDegrees}, ${decDegrees})) * 3600 AS arcsec FROM gaiadr3.vari_cepheid AS c JOIN gaiadr3.gaia_source AS g ON g.source_id = c.source_id WHERE 1 = CONTAINS(POINT('ICRS', g.ra, g.dec), CIRCLE('ICRS', ${raDegrees}, ${decDegrees}, ${AT_PLACE_ARCSEC / 3600}))` });

/** The period a package's own catalogue row prints, in days: its `Per` or `Pr` column, or ten to its `logP`. */
export function cataloguedPeriodDays(tsv: string): number | undefined {
  const lines = tsv.split(/\r?\n/u).filter(line => line.trim()), header = (lines[0] ?? '').split('\t').map(cell => cell.trim()), row = (lines.at(-1) ?? '').split('\t');
  const cell = (name: string) => { const at = header.indexOf(name), text = at < 0 ? '' : (row[at] ?? '').trim(), value = Number(text); return text && Number.isFinite(value) ? value : undefined; };
  const days = cell('Per') ?? cell('Pr'), log = cell('logP');
  return days !== undefined && days > 0 ? days : log !== undefined ? 10 ** log : undefined;
}

/** Find the row of Gaia's table that is this star's, and write it into the star's package as a source input. A star the
 * limits above do not tie to one row is refused with the numbers. */
export async function installPublishedModel(root: string, host: string, archive: Archive): Promise<{ readonly sourceId: string; readonly tied: string }> {
  const at = `src/objects/${host}`, read = (path: string) => readFile(resolve(root, path), 'utf8');
  const body = requireRecord(await readJson(resolve(root, 'packages/astronomy/data/bodies', `${host}.json`), `${host}: no astronomy record`), `${host} astronomy record`), place = requireRecord(body.star, `${host}: its astronomy record places no star`);
  const ra = requireFiniteNumber(place.rightAscensionDegrees, `${host} right ascension`), dec = requireFiniteNumber(place.declinationDegrees, `${host} declination`);
  const printed = cataloguedPeriodDays(await read(`${at}/source/${CATALOGUE_ROW}`).catch(() => { throw new Error(`${host}: its package keeps no catalogue row (${CATALOGUE_ROW}) to read its period from.`); }));
  if (printed === undefined) throw new Error(`${host}: its catalogue row prints no period (a Per, Pr or logP column).`);
  const near = (await archive.text(GAIA_TAP, cepheidsAtForm(ra, dec))).trim().split(/\r?\n/u).slice(1).map(line => line.split(','));
  if (near.length !== 1) throw new Error(`${host}: Gaia DR3 lists ${near.length === 0 ? 'no Cepheid' : `${near.length} Cepheids`} within ${AT_PLACE_ARCSEC} arcsecond of its place.`);
  const sourceId = near[0]![0]!.trim(), arcsec = Number(near[0]![1]), csv = await archive.text(GAIA_TAP, gaiaCepheidForm(sourceId)), kind = gaiaCepheidClass(csv);
  if (kind?.mode !== 'FUNDAMENTAL') throw new Error(`${host}: Gaia DR3 models source ${sourceId} in the mode ${JSON.stringify(kind?.mode ?? '')}; only a fundamental-mode model is read.`);
  const where = `${host}: Gaia DR3 vari_cepheid ${sourceId}`, model = parseGaiaCepheidRow(csv, where); checkGaiaCepheidModel(model, where);
  if (Math.abs(model.periodDays / printed - 1) > SAME_PERIOD) throw new Error(`${host}: Gaia DR3's period for the Cepheid at its place, ${model.periodDays.toFixed(3)} d (source ${sourceId}), is not within ${100 * SAME_PERIOD}% of the ${Number(printed.toPrecision(4))} d its own catalogue row prints.`);
  const tied = `${TIED} the one Gaia DR3 Cepheid within ${AT_PLACE_ARCSEC} arcsecond of it (${arcsec.toFixed(2)} arcseconds away), whose period, ${model.periodDays.toFixed(3)} d, is within ${100 * SAME_PERIOD}% of the ${Number(printed.toPrecision(4))} d the star's own catalogue row prints.`;
  const content = requireRecord(await readJson(resolve(root, `${at}/source/content/object.json`), `${host}: no such page`), `${host} content`), files = new Map<string, string | Buffer>();
  for (const path of [`${at}/source/preparation/acquisition.json`, `${at}/source/manifest.json`, `${at}/NOTICE.md`]) files.set(path, await read(path));
  installLightCurveRow(files, { id: host, name: requireString(content.displayName, `${host} display name`), sourceId, csv, consumers: [PULSATION_MODEL_CONSUMER], tied });
  for (const [path, value] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), value); }
  return { sourceId, tied };
}

/** Whether a package declares the published model among its source inputs. */
async function declares(root: string, host: string): Promise<boolean> {
  const manifest: unknown = await readFile(resolve(root, 'src/objects', host, 'source/manifest.json'), 'utf8').then(text => JSON.parse(text) as unknown, () => undefined);
  return isRecord(manifest) && Array.isArray(manifest.inputs) && manifest.inputs.some(input => isRecord(input) && input.path === PULSATION_MODEL);
}

/** `--from-pulsation all | HOST...`: one entry a star whose package keeps a published light-curve model, with the cycle's
 * steps; `all` is every such star. A star with no model, or whose row is not restored, is reported and left out. */
export async function draftsFromPulsation(names: readonly string[], context: RouteContext & { readonly archive?: Archive }): Promise<{ readonly stars: readonly unknown[]; readonly pulsations: readonly unknown[]; readonly report: readonly string[] }> {
  const all = names.length === 1 && names[0] === 'all', pulsations: unknown[] = [], report: string[] = []; let without = 0;
  const hosts = all ? (await readdir(resolve(context.root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : names;
  for (const name of hosts) { const host = name.replace(/^gaia:/u, '');
    // `gaia:HOST`: a star whose package keeps no model is first looked up in Gaia's table at its place, and its row installed.
    if (name !== host && !await declares(context.root, host)) {
      try { if (!context.archive) throw new Error(`${host}: no archive to ask.`); const found = await installPublishedModel(context.root, host, context.archive); report.push(`  ${host}: row of Gaia DR3 source ${found.sourceId} installed. ${found.tied}`); }
      catch (error) { report.push(`  ${host}: not drafted: ${reason(error)}`); continue; } }
    if (!await declares(context.root, host)) { without += 1; if (!all) report.push(`  ${host}: not drafted: its package keeps no published light-curve model (${PULSATION_MODEL}); gaia:${host} looks for one at its place`); continue; }
    try { const { model, check } = await modelOf(context.root, host); pulsations.push({ host, maps: Array.from({ length: PHASES }, (_, index) => phaseChoice(host, index)) });
      if (!all) report.push(`  ${host}: ${PHASES} phases of ${model.periodDays.toFixed(3)} d, ${check.peakToPeakMag.toFixed(3)} mag peak to peak`); }
    catch (error) { report.push(`  ${host}: not drafted: ${reason(error)}`); }
  }
  if (all) report.push(`  ${pulsations.length} stars with a published light-curve model; ${without} objects without one.`);
  return { stars: [], pulsations, report };
}
