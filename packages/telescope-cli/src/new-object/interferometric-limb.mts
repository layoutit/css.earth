/** A star's limb fitted to its own interferometry, for a star no paper gives a law for and no model grid reaches: the power law
 * I(mu) = mu^alpha that fitPowerLawDisc (@cssearth/telescope-cli, disc-fit.mts) fits inside the first lobe of the calibrated
 * visibilities an observation season records for it (packages/telescope-cli/src/archives/interferometry/seasons/). The first lobe
 * is where the whole disc dominates; past the null a spotted star's cells do. The law is written as a record beside the star, with
 * the tool, the input and the data it was fitted to, and star-limb.mts installs it as it installs a paper's. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readChannelRows } from '@cssearth/bake/objects/layers/observation';
import { fitPowerLawDisc } from '../archives/interferometry/disc-fit.mts';

const SEASONS = 'packages/telescope-cli/src/archives/interferometry/seasons';
/** The band each instrument's calibrated file is fitted in, as its season's observations record it. */
const BANDS: Readonly<Record<string, string>> = { pionier: 'VLTI/PIONIER H band (1.5-1.8 um); not a visible band' };

/** Writes `source/photometry/<season>-first-lobe-limb-darkening.json` for the first season of `id` whose instrument has a band here
 * and that names a calibrated file, and returns its path; undefined when there is none. */
export async function fitInterferometricLimb(root: string, id: string, progress: (line: string) => void = () => {}): Promise<string | undefined> {
  for (const name of (await readdir(resolve(root, SEASONS)).catch(() => [] as string[])).sort()) {
    const path = resolve(root, SEASONS, name, 'season.json');
    const season = requireRecord(JSON.parse(await readFile(path, 'utf8').catch(() => 'null')) ?? {}, path);
    if (season.object !== id) continue;
    const instrument = requireString(season.instrument, `${path} instrument`), band = BANDS[instrument];
    const calibrated = (season.oracles as { calibrated?: unknown } | undefined)?.calibrated;
    if (!band || typeof calibrated !== 'string') { progress(`  ${id}: season ${name} has no calibrated ${instrument} file this fit reads`); continue; }
    const uniformMas = requireFiniteNumber(requireRecord(season.referenceDiameter, `${path} referenceDiameter`).mas, `${path} referenceDiameter.mas`);
    progress(`  ${id}: fitting the first lobe of ${calibrated} (${name})`);
    const fit = fitPowerLawDisc(readChannelRows(await readFile(resolve(root, calibrated))), { uniformMas });
    const alpha = Number(fit.alpha.toFixed(2)), uncertainty = Math.ceil(Math.max(fit.alpha - fit.alphaRange[0], fit.alphaRange[1] - fit.alpha) * 100 - 1e-6) / 100;
    const sourceDirectory = resolve(root, 'src/objects', id, 'source'), input = relative(sourceDirectory, resolve(root, calibrated));
    const title = requireString(season.title, `${path} title`), record = {
      schema: 'cssearth-published-limb-darkening@1', objectId: id,
      source: `${title}, the calibrated visibilities in ${input}`,
      fit: { tool: 'fitPowerLawDisc (packages/telescope-cli/src/archives/interferometry/disc-fit.mts), run by node tools/objects/new-object.mts --star-limb', input, data: `the calibrated ${instrument.toUpperCase()} visibilities of ${title.split(',')[0]}, inside the first lobe` },
      band, law: 'power', basis: 'fit',
      alpha: { value: alpha, uncertainty, cell: `alpha ${alpha} (${fit.alphaRange[0].toFixed(2)} to ${fit.alphaRange[1].toFixed(2)} with the diameter refitted), limb-darkened diameter ${fit.diameterMas.toFixed(2)} mas, reduced chi-squared ${fit.reducedChi2.toFixed(2)} over the ${fit.points} squared visibilities shorter than the first null of the ${uniformMas} mas uniform disc; the uncertainty is the larger side` },
      note: 'No paper publishes a limb law for this star and no model grid reaches it. The first lobe is where the whole disc dominates; past it the surface structure does, and a law fitted there measures the structure, not the limb.',
    };
    const out = resolve(sourceDirectory, 'photometry', `${name}-first-lobe-limb-darkening.json`);
    await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
    return out;
  }
  return undefined;
}
