/** A Cepheid's published light curve installed in a star package: the Gaia DR3 vari_cepheid row it plays (acquisition step,
 * manifest input and catalogue record), the presentation field that asks the bake for it, and the credit and README account.
 * Shared by the Cepheid route (generate.mts) and by packages made before it. The bake reads the row, checks it against its own
 * published values and plays it (@cssearth/bake/photometry, light-curve.ts). */
import { checkGaiaCepheidModel, gaiaCepheidQuery, GAIA_TIME_OFFSET_JD, parseGaiaCepheidRow, PULSATION_SECONDS_PER_DAY } from '@cssearth/bake/photometry';
import type { SolarEpoch } from './solar-epoch.mts';
import { GAIA_TAP } from './archives/archives.mts';
import { CHECKED } from './color.mts';
import { bindInputs, json, type PackageFiles } from './dataset.mts';

export const LIGHT_CURVE_MODEL = 'photometry/gaia-dr3-vari-cepheid.csv';
const PAPER = 'Ripepi et al. (2023), A&A 674, A17';
const PAPER_URL = 'https://doi.org/10.1051/0004-6361/202243990';
const GAIA_LICENSE = { license: 'Gaia data are public under the ESA Gaia data policy; the Gaia/DPAC credit is retained', licenseEvidence: ['https://www.cosmos.esa.int/web/gaia-users/credits'] };

/** The TAP form the acquisition step posts for one source. */
export function gaiaCepheidForm(sourceId: string): Record<string, string> {
  return { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: gaiaCepheidQuery(sourceId) };
}

/** Install the light curve read from `csv` (the archive's answer to gaiaCepheidForm) into a package's files. */
export function installLightCurve(files: PackageFiles, { id, name, sourceId, csv }: { id: string; name: string; sourceId: string; csv: string }, { SOLAR_GEOMETRY_EPOCH_JD_TT, SOLAR_GEOMETRY_EPOCH_LABEL }: SolarEpoch) {
  const o = `src/objects/${id}`, s = `${o}/source`, where = `${id}: Gaia DR3 vari_cepheid ${sourceId}`;
  const read = (path: string) => { const value = files.get(path); if (value === undefined) throw new Error(`${id}: ${path} is not in the package.`); return String(value); };
  const model = parseGaiaCepheidRow(csv, where), check = checkGaiaCepheidModel(model, where);
  if (model.sourceId !== sourceId) throw new TypeError(`${where}: the archive answered for source ${model.sourceId}.`);
  const cycles = (SOLAR_GEOMETRY_EPOCH_JD_TT - GAIA_TIME_OFFSET_JD - check.maximumTime) / model.periodDays;
  const phase = cycles - Math.floor(cycles), phaseError = Math.abs(cycles) * model.periodErrorDays / model.periodDays;
  const harmonics = model.amplitudesMag.length === 1 ? 'one harmonic' : `${model.amplitudesMag.length} harmonics`;
  const fraction = 10 ** (-0.4 * check.peakToPeakMag), days = model.periodDays.toFixed(model.periodDays < 10 ? 3 : 2);
  const locator = `gaiadr3.vari_cepheid: pf ${model.periodDays} +/- ${model.periodErrorDays} d, ${model.amplitudesMag.length} G-band harmonics, peak_to_peak_g ${model.peakToPeakMag} mag, epoch_g ${model.epochMaximum} +/- ${model.epochMaximumError} (BJD TCB - 2455197.5)`;

  const plan = JSON.parse(read(`${s}/preparation/acquisition.json`)) as { operations: Record<string, unknown>[] };
  plan.operations = [...plan.operations.filter(step => step.path !== LIGHT_CURVE_MODEL),
    { kind: 'request-download', groups: ['restore', 'refresh'], path: LIGHT_CURVE_MODEL, url: GAIA_TAP, form: gaiaCepheidForm(sourceId), requiredPrefix: 'source_id,pf,' }];
  files.set(`${s}/preparation/acquisition.json`, json(plan));
  // The row itself, as the acquisition step restores it: the bake reads the model from it.
  files.set(`${s}/${LIGHT_CURVE_MODEL}`, csv);
  const manifest = JSON.parse(read(`${s}/manifest.json`)) as { inputs: Record<string, unknown>[] };
  manifest.inputs = [...manifest.inputs.filter(input => input.path !== LIGHT_CURVE_MODEL), { id: `${id}-gaia-dr3-vari-cepheid`, path: LIGHT_CURVE_MODEL, origin: GAIA_TAP,
    credit: `ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; ${PAPER}`, ...GAIA_LICENSE,
    acquisition: `Gaia Archive TAP query in source/preparation/acquisition.json: the vari_cepheid row of source_id ${sourceId} (period, G-band harmonic amplitudes and phases, epoch of maximum, peak-to-peak amplitude, R21 and phi21).`,
    redistribution: 'One catalogue row, retained unchanged with its credit.', consumers: ['presentation'] }];
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
  const presentation = JSON.parse(read(`${s}/preparation/presentation.json`)) as Record<string, unknown>;
  files.set(`${s}/preparation/presentation.json`, json({ ...presentation, lightCurve: { model: LIGHT_CURVE_MODEL } }));
  files.set(`src/sources/gaia-dr3-vari-cepheid-${id}.json`, json({ id: `gaia-dr3-vari-cepheid-${id}`, kind: 'data-product', identityLevel: 'work',
    title: `Gaia DR3 vari_cepheid row for ${name} (source_id ${sourceId})`, identifiers: [{ type: 'Gaia DR3 vari_cepheid source_id', value: sourceId }],
    links: [{ role: 'archive', url: 'https://gea.esac.esa.int/archive/', label: 'Gaia Archive' }, { role: 'landing', url: PAPER_URL, label: `${PAPER}, the Cepheid sample` }],
    evidence: [{ url: `${GAIA_TAP}?${new URLSearchParams(gaiaCepheidForm(sourceId))}`, checkedOn: CHECKED, locator }],
    relations: [], statements: [{ kind: 'credit', text: `ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; ${PAPER}`, scope: 'citation', evidence: 'https://www.cosmos.esa.int/web/gaia-users/credits' }] }));

  const credit = `Light curve: Gaia DR3 vari_cepheid, source ${sourceId}; ${PAPER}.`;
  const notice = read(`${o}/NOTICE.md`).replace(/\n\nLight curve: Gaia DR3 vari_cepheid[^\n]*/u, '').trimEnd();
  files.set(`${o}/NOTICE.md`, `${notice}\n\n${credit}\n`);
  const paragraph = `**Brightness.** Gaia DR3 fits the star's G-band light with ${harmonics} of a ${days}-day period (vari_cepheid, source ${sourceId}; the fit is described by ${PAPER}). ` +
    `It swings ${check.peakToPeakMag.toFixed(3)} mag, so at minimum the star gives ${(fraction * 100).toFixed(0)}% of its peak light. The page plays that model: a black veil over the disc ` +
    `passes the flux ratio through the sRGB encoding (IEC 61966-2-1), so a white pixel gives that fraction of its light, ${1 / PULSATION_SECONDS_PER_DAY === 1 ? 'one day' : `${1 / PULSATION_SECONDS_PER_DAY} days`} of the cycle each second (a display rate). ` +
    `It starts at the phase for the scene date, ${SOLAR_GEOMETRY_EPOCH_LABEL}: ${phase.toFixed(2)} of a cycle after maximum. It plays when Motion is on.`;
  const evidence = `- The bake reads Gaia's harmonics as published and holds them to the same row's peak-to-peak amplitude, epoch of maximum, R21 and phi21 ([light-curve.ts](../../../packages/bake/src/photometry/light-curve.ts)); on ${CHECKED} the model's maximum fell ${Math.abs(check.maximumTime - model.epochMaximum).toFixed(4)} d from epoch_g (stated error ${model.epochMaximumError.toFixed(4)} d; ${(Math.abs(check.maximumTime - model.epochMaximum) / model.periodDays).toFixed(5)} of a period).`;
  const problem = `- **Brightness.** The model is Gaia's 2014-2017 fit carried ${Math.abs(cycles).toFixed(0)} cycles to the scene date; with the period's error the phase shown is known to ${phaseError.toFixed(2)} of a cycle, and period changes after 2017 are not included. The G band stands for all colors: the star's temperature and color change through the cycle, and the page does not show that.`;
  const lines = read(`${o}/README.md`).split('\n').filter(line => !line.startsWith('**Brightness.**') && !line.startsWith('- **Brightness.**') && !line.includes('light-curve.ts'));
  const insert = (heading: string, text: string, before: boolean) => {
    const at = lines.indexOf(heading);
    if (at < 0) throw new Error(`${id}: README.md has no "${heading}" section.`);
    if (before) lines.splice(at, 0, text, '');
    else {
      let end = at + 1; while (end < lines.length && !lines[end]!.startsWith('## ') && !lines[end]!.startsWith('[')) end++; while (lines[end - 1] === '') end--;
      lines.splice(end, 0, ...lines[end - 1]!.startsWith('- ') ? [text] : ['', text]);
    }
  };
  insert('## Evidence', paragraph, true);
  insert('## Evidence', evidence, false);
  insert('## Known problems', problem, false);
  files.set(`${o}/README.md`, lines.join('\n').replace(/\n{3,}/gu, '\n\n'));
  // The investigation-ledger decision the package records beside its other findings.
  const decision = { id: 'light-curve', subject: 'Light curve', evidence: ['https://gea.esac.esa.int/archive/', PAPER_URL],
    finding: `Gaia DR3 vari_cepheid, source ${sourceId}: ${model.amplitudesMag.length} G-band harmonic${model.amplitudesMag.length === 1 ? '' : 's'} of a ${model.periodDays} d period, peak-to-peak ${check.peakToPeakMag.toFixed(3)} mag; the harmonics reproduce the row's epoch of maximum and peak-to-peak amplitude. The page plays it as a veil over the disc from the scene date, phase known to ${phaseError.toFixed(2)} of a cycle there.` };
  return { model, check, phase, phaseError, decision };
}
