/** A pulsating star's light through one cycle, as steps of one dataset group on the star's page.
 *
 * The light is a published model: the Fourier series Gaia DR3 fits to a Cepheid's G-band time series and prints, harmonic
 * by harmonic, in its `vari_cepheid` table (Ripepi et al. 2023, A&A 674, A17), which the star's package already keeps as a
 * source file. `@cssearth/bake/photometry` reads the row and holds it to the peak-to-peak amplitude, the epoch of maximum
 * and the Fourier ratios the same row states. Nothing is fitted here: a step is the model's value at one phase, turned from
 * magnitudes into a share of the light at maximum, which is arithmetic.
 *
 * A step draws the star's own color dimmed to that share. No color change is drawn: the star's color does change through
 * the cycle, and no published calibration found turns Gaia's two colors into a Cepheid's temperature. No change of size is
 * drawn either. What is this repository's is the number of steps and where they are taken (`PHASES`), and that the G band
 * stands for all colors; the method note lists both.
 *
 * This module is that kind of dataset for surface-maps.mts. It is pure: pulsation.mts reads and writes. */
import { type GaiaCepheidCheck, type GaiaCepheidModel, gaiaMagnitude } from '@cssearth/bake/photometry';
import type { MapKind, SurfaceMap, SurfaceMapChoice } from '../maps/surface-maps.mts';

export const PULSATION_GENERATOR = 'packages/telescope-cli/src/new-object/pulsation/pulsation.mts', PULSATION_CONSUMER = 'gaia-cepheid-phases', PULSATION_GROUP = 'pulsation';
/** What reads the archived row on a page that does not play it: the generator, which builds the steps' table from it. It is
 * not the steps' own name: a run replaces every manifest entry under that name, and the row is not one of them. */
export const PULSATION_MODEL_CONSUMER = 'gaia-cepheid-model';
/** A display choice, not science: one cycle is shown at ten moments a tenth of a period apart, the first at maximum light,
 * as phases are counted for a Cepheid. The model is continuous; the steps only sample it. */
export const PHASES = 10;
const ARCHIVE = 'https://gea.esac.esa.int/archive/', PAPER = 'Ripepi et al. (2023), A&A 674, A17', CREDITS = 'https://www.cosmos.esa.int/web/gaia-users/credits';
const GAIA_RECORD = 'gaia-2023-dr3', GAIA_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355';
export const PULSATION_DIRECTORY = 'science/pulsation', PULSATION_TABLE = 'gaia-dr3-g-phases';

/** One step: the star at one phase of the cycle. */
export interface PulsationStep extends SurfaceMap { readonly host: string; readonly sourceId: string; /** Which tenth of the cycle after maximum light, 0 to 9. */ readonly index: number;
  /** The light at this phase as a share of the light at maximum, and of every step of the cycle; and the least the model reaches, which falls between two steps. */ readonly share: number; readonly shares: readonly number[]; readonly faintest: number;
  readonly harmonics: number; readonly peakToPeakMag: number; /** Whether the page also plays the light curve over its other datasets. */ readonly played: boolean }

export const phaseChoice = (host: string, index: number): SurfaceMapChoice => ({ program: `${host}-phase-${index}`, id: `${PULSATION_GROUP}-phase-${index}`, label: `Phase ${(index / PHASES).toFixed(1)}` });
/** Which step a spec's choice names; a spec lists the cycle's steps by these ids and no others. */
export function phaseIndex(choice: SurfaceMapChoice): number { const found = new RegExp(`^${PULSATION_GROUP}-phase-(\\d)$`, 'u').exec(choice.id), index = found ? Number(found[1]) : Number.NaN;
  if (!(index >= 0 && index < PHASES)) throw new TypeError(`${choice.id}: a pulsation step is ${PULSATION_GROUP}-phase-0 to ${PULSATION_GROUP}-phase-${PHASES - 1}.`); return index; }

/** The model's light at each step, as a share of its light at maximum: 10^(-0.4 (m - m at maximum)). */
export function phaseShares(model: GaiaCepheidModel, check: GaiaCepheidCheck): number[] {
  return Array.from({ length: PHASES }, (_, index) => 10 ** (-0.4 * (gaiaMagnitude(model, check.maximumTime + index / PHASES * model.periodDays) - check.brightestMag))); }

const variable = (index: number) => `Light at phase ${(index / PHASES).toFixed(1)} [%]`;
/** The steps as the table layout the star packages read (`tecplot-lonlat-map`): one column a step, percent of the light at
 * maximum. The disc is unresolved, so every node of the grid holds the whole disc's value: the grid is the file's layout,
 * not a map. */
export function phaseTable(name: string, sourceId: string, shares: readonly number[]): string {
  const row = (longitude: number, latitude: number) => `${longitude} ${latitude} ${shares.map(share => (100 * share).toFixed(3)).join(' ')}`;
  return [`TITLE     = "${name}: light of the whole disc at ${PHASES} phases of one pulsation, percent of the light at maximum (Gaia DR3 vari_cepheid ${sourceId}, G band)"`,
    `VARIABLES = "Longitude [Deg]" "Latitude [Deg]" ${shares.map((_, index) => `"${variable(index)}"`).join(' ')}`, 'ZONE I=2, J=2, K=1, ZONETYPE=Ordered', 'DATAPACKING=POINT', row(0, -90), row(360, -90), row(0, 90), row(360, 90), ''].join('\n');
}

const toLinear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
const fromLinear = (unit: number) => 255 * (unit <= 0.0031308 ? 12.92 * unit : 1.055 * unit ** (1 / 2.4) - 0.055);
/** How many colors the scale from no light to the light at maximum is written with. Between two of them a surface is
 * drawn by a straight line in display values: at 21 that line stays within a third of a display level of the true curve
 * for any share over a fifth, and no Cepheid here falls under it. The bake draws a nearest-sampled scale in 256 steps
 * (scientific-raster.ts), so a step is drawn within a fifth of a percent of its share; with the rounding of each color
 * that is under two display levels in all (the pages test holds every baked step to it). */
const STOPS = 21;
/** The star's color at every twentieth of its light, from none to all of it: each channel's light scaled, then encoded for
 * the display (IEC 61966-2-1), so a step at 57% gives 57% of the light of the step at maximum. */
export function dimmed(colorHex: string): string[] { const color = [1, 3, 5].map(at => toLinear(Number.parseInt(colorHex.slice(at, at + 2), 16)));
  return Array.from({ length: STOPS }, (_, stop) => `#${color.map(channel => Math.round(fromLinear(channel * stop / (STOPS - 1))).toString(16).padStart(2, '0')).join('')}`); }

const span = (days: number) => days >= 100 ? `${Math.round(days)} days` : days >= 10 ? `${days.toFixed(1)} days` : days >= 1 ? `${days.toFixed(2)} days` : `${(days * 24).toFixed(1)} hours`;
const cycle = (days: number) => days >= 100 ? `${Math.round(days)}` : days >= 10 ? days.toFixed(1) : days.toFixed(2);
const percent = (share: number) => (100 * share).toFixed(0);

/** One step of the cycle, from the star's archived row as read and checked. */
export function pulsationStep(choice: SurfaceMapChoice, star: { readonly host: string; readonly name: string; readonly played: boolean }, model: GaiaCepheidModel, check: GaiaCepheidCheck): PulsationStep {
  const index = phaseIndex(choice), shares = phaseShares(model, check);
  return { choice, host: star.host, table: phaseTable(star.name, model.sourceId, shares), targetName: star.name, sourceId: model.sourceId, index, share: shares[index]!, shares, faintest: 10 ** (-0.4 * check.peakToPeakMag), harmonics: model.amplitudesMag.length, peakToPeakMag: check.peakToPeakMag, played: star.played,
    // The whole disc is one value: no axis is drawn or used.
    inclinationDegrees: 90, inclinationSource: 'not used: the disc is unresolved and one value is drawn over it',
    periodDays: model.periodDays, periodSource: `Gaia DR3 vari_cepheid, source ${model.sourceId}: pf ${model.periodDays} +/- ${model.periodErrorDays} d (${PAPER})` };
}

/** What is a pulsation step's own in the records surface-maps.mts writes. */
export const PULSATION_STEPS: MapKind<PulsationStep> = {
  consumer: PULSATION_CONSUMER, directory: PULSATION_DIRECTORY, inputTag: 'gaia-cepheid-phases', stepGroup: PULSATION_GROUP, generator: PULSATION_GENERATOR,
  variable: variable(0), variableOf: step => variable(step.index), tableOf: () => PULSATION_TABLE, units: '%', controlLabel: 'Pulsation', legendTitle: 'Light',
  archiveUrl: ARCHIVE, references: [], referencesOf: step => [{ catalogueId: `gaia-dr3-vari-cepheid-${step.host}`, role: 'material', evidence: `src/objects/${step.host}/source/photometry/gaia-dr3-vari-cepheid.csv` }, { catalogueId: GAIA_RECORD, role: 'reference', evidence: GAIA_URL }],
  // The colors of a false-color scale, which a step is not: a step is drawn through `look`.
  colors: ['#000000', '#ffffff'], palette: [[0, 0, 0], [255, 255, 255]],
  scale: () => ({ minimum: 0, maximum: 100, labels: ['0%', '100%'] }),
  outlines: () => false, displaySampling: 'nearest',
  look: (_step, star) => dimmed(star.colorHex),
  words(step, { star }) { const { choice, index } = step, phase = (index / PHASES).toFixed(1), after = span(index / PHASES * step.periodDays), period = cycle(step.periodDays), light = percent(step.share), faintest = percent(step.faintest);
    const harmonics = step.harmonics === 1 ? 'one harmonic' : `${step.harmonics} harmonics`, when = index === 0 ? 'at maximum light' : `${after} after maximum light`;
    return { productId: `Light of ${step.targetName} at ${PHASES} phases of one pulsation, from Gaia DR3 vari_cepheid ${step.sourceId}`,
      inputTitle: `Light of ${step.targetName}'s whole disc at ${PHASES} phases of one pulsation, percent of its light at maximum: Gaia DR3's G-band Fourier model evaluated a tenth of a period apart`,
      credit: `ESA/Gaia/DPAC; Gaia Collaboration (2023), A&A 674, A1; ${PAPER}; the model's values at ${PHASES} phases computed in this project`, displayCredit: 'ESA/Gaia/DPAC',
      license: 'Gaia data are public under the ESA Gaia data policy; the Gaia/DPAC credit is retained', licenseEvidence: [CREDITS],
      acquisition: `Built by the generator from the star's archived Gaia DR3 vari_cepheid row (photometry/gaia-dr3-vari-cepheid.csv): the published harmonics evaluated at ${PHASES} phases from maximum light and turned from magnitudes into shares of the light at maximum. Tracked.`,
      redistribution: 'Values computed from one public catalogue row, with its credit.',
      description: `${step.targetName}'s light ${when} (phase ${phase} of its ${period}-day pulsation): ${light}% of its light at maximum, from the Fourier model Gaia DR3 publishes for the star's G-band time series (vari_cepheid, source ${step.sourceId}; ${harmonics}; ${PAPER}). The star's color (${star.colorHex ? `${star.colorHex}, ` : ''}its Color dataset) is dimmed to that share of its light. The disc is unresolved, so one value is drawn over all of it, and the darkening toward the edge is the Color dataset's. Over the cycle the model's light falls to ${faintest}% of its maximum (${step.peakToPeakMag.toFixed(3)} mag peak to peak). No change of color or of size is drawn: the G band stands for all colors here.`,
      surfaceTitle: `Gaia DR3 · light through one pulsation · ${choice.label.toLowerCase()}`, qualification: `Gaia DR3 fitted light curve · ${index === 0 ? 'maximum light' : `${after} after maximum`}`,
      notes: `${step.targetName} ${when}, phase ${phase} of one ${period}-day pulsation: its color dimmed to ${light}% of its light at maximum, as Gaia DR3's published G-band model of the star gives it. The ${PHASES} steps are a tenth of a period apart (a display choice); the model between them is continuous. The star's color and size also change through the cycle and are not drawn: nothing here measures them.${step.played ? ' The played light curve (the Light curves switch) is not drawn over these steps: each already holds its own light.' : ''}`,
      legendNote: '',
      text: { title: index === 0 ? 'Light at maximum' : `Light ${after} after maximum`, detail: 'Gaia DR3',
        summary: index === 0 ? `The star at its brightest in Gaia's G band, the start of one ${period}-day pulsation.` : `${light}% of its brightest light in Gaia's G band, ${after} into one ${period}-day pulsation.` } }; },
  report(steps) { const first = steps[0]!; return `${steps.length} phases of one ${cycle(first.periodDays)}-day pulsation; the light falls to ${percent(first.faintest)}% of maximum (Gaia DR3 G band, ${first.harmonics === 1 ? 'one harmonic' : `${first.harmonics} harmonics`})`; },
};
