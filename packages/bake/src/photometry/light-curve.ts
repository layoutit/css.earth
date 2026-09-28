/**
 * A pulsating star's brightness from its published light-curve model. Gaia DR3 fits every Cepheid's G-band time series
 * with a truncated Fourier series and publishes each harmonic's amplitude and phase (gaiadr3.vari_cepheid; Ripepi et al.
 * 2023, A&A 674, A17). Preparation reads that model as published, checks it against the peak-to-peak amplitude, the epoch
 * of maximum and the Fourier ratios the same row states, and turns one period into the opacity of a black veil over the
 * disc. Nothing here is fitted or authored except the display rate, which is presentation.
 */
import { linearToSrgb } from './limb.ts';

/** Gaia DR3 times are barycentric Julian days in TCB minus this offset (Gaia DR3 documentation, time scales). */
export const GAIA_TIME_OFFSET_JD = 2455197.5;

/** Presentation, not science: three days of pulsation play in one second, so every star keeps its period ratio to the others.
 * At one day per second a 13-day fade went unnoticed; at three the loops run 0.88 s (HV 12199) to 23 s (S Vul). */
export const PULSATION_SECONDS_PER_DAY = 1 / 3;

/** Half an 8-bit display level: keyframes are added until linear interpolation between them stays within it. */
const DISPLAY_TOLERANCE = 0.5 / 255;

export interface GaiaCepheidModel {
  readonly sourceId: string;
  readonly periodDays: number;
  readonly periodErrorDays: number;
  readonly frequencyPerDay: number;
  /** Gaia time (BJD TCB - 2455197.5) the harmonic phases refer to. */
  readonly referenceTime: number;
  readonly zeroPointMag: number;
  readonly amplitudesMag: readonly number[];
  readonly phasesRadians: readonly number[];
  readonly epochMaximum: number;
  readonly epochMaximumError: number;
  readonly peakToPeakMag: number;
  readonly r21: number | null;
  readonly phi21: number | null;
  /** Gaia's type: DCEP (classical), T2CEP (type II) or ACEP (anomalous). */
  readonly type: string;
}

/** The columns the acquisition query selects, in its order. */
export const GAIA_CEPHEID_COLUMNS = ['source_id', 'pf', 'pf_error', 'fund_freq1', 'reference_time_g', 'zp_mag_g', 'num_harmonics_for_p1_g',
  'fund_freq1_harmonic_ampl_g', 'fund_freq1_harmonic_phase_g', 'epoch_g', 'epoch_g_error', 'peak_to_peak_g', 'r21_g', 'phi21_g',
  'mode_best_classification', 'type_best_classification'] as const;

/** The ADQL the acquisition plan sends to the Gaia archive for one source. */
export function gaiaCepheidQuery(sourceId: string): string {
  if (!/^\d{6,20}$/u.test(sourceId)) throw new TypeError(`Gaia DR3 source id must be digits, got ${JSON.stringify(sourceId)}.`);
  return `SELECT ${GAIA_CEPHEID_COLUMNS.join(', ')} FROM gaiadr3.vari_cepheid WHERE source_id = ${sourceId}`;
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = '', quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { cells.push(cell); cell = ''; }
    else cell += character;
  }
  cells.push(cell);
  return cells;
}

/** What the archive's answer says about a star before it is read as a model: no row (not a Gaia Cepheid), or its mode and type. */
export function gaiaCepheidClass(text: string): { mode: string; type: string } | null {
  const lines = text.trim().split(/\r?\n/u);
  if (lines.length < 2) return null;
  const header = csvCells(lines[0]!), cells = csvCells(lines[1]!), at = (name: string) => cells[header.indexOf(name)]?.trim() ?? '';
  return { mode: at('mode_best_classification'), type: at('type_best_classification') };
}

/** Parse the archived vari_cepheid row. `where` names the file in every refusal. */
export function parseGaiaCepheidRow(text: string, where: string): GaiaCepheidModel {
  const lines = text.trim().split(/\r?\n/u);
  if (lines.length !== 2) throw new TypeError(`${where}: expected a header and one vari_cepheid row, got ${lines.length} lines.`);
  const header = csvCells(lines[0]!), cells = csvCells(lines[1]!);
  const missing = GAIA_CEPHEID_COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new TypeError(`${where}: missing columns ${missing.join(', ')}.`);
  const cell = (name: typeof GAIA_CEPHEID_COLUMNS[number]) => cells[header.indexOf(name)]!.trim();
  const number = (name: typeof GAIA_CEPHEID_COLUMNS[number]) => {
    const value = Number(cell(name));
    if (cell(name) === '' || !Number.isFinite(value)) throw new TypeError(`${where}: ${name} must be a finite number, got ${JSON.stringify(cell(name))}.`);
    return value;
  };
  const optional = (name: typeof GAIA_CEPHEID_COLUMNS[number]) => cell(name) === '' ? null : number(name);
  const vector = (name: typeof GAIA_CEPHEID_COLUMNS[number]) => {
    const match = /^\((.*)\)$/u.exec(cell(name));
    if (!match) throw new TypeError(`${where}: ${name} must be a parenthesised list, got ${JSON.stringify(cell(name))}.`);
    return match[1]!.split(',').map(entry => Number(entry.trim()));
  };
  const mode = cell('mode_best_classification');
  if (mode !== 'FUNDAMENTAL') throw new TypeError(`${where}: mode_best_classification is ${JSON.stringify(mode)}; only fundamental-mode models (pf) are read.`);
  const harmonics = number('num_harmonics_for_p1_g');
  const amplitudes = vector('fund_freq1_harmonic_ampl_g'), phases = vector('fund_freq1_harmonic_phase_g');
  if (!Number.isInteger(harmonics) || harmonics < 1 || harmonics > amplitudes.length || harmonics > phases.length)
    throw new TypeError(`${where}: num_harmonics_for_p1_g ${harmonics} does not fit the ${amplitudes.length} published amplitudes.`);
  const amplitudesMag = amplitudes.slice(0, harmonics), phasesRadians = phases.slice(0, harmonics);
  if (![...amplitudesMag, ...phasesRadians].every(Number.isFinite) || amplitudes.slice(harmonics).some(Number.isFinite))
    throw new TypeError(`${where}: the first ${harmonics} harmonic amplitudes must be finite and the rest NaN, got ${cell('fund_freq1_harmonic_ampl_g')}.`);
  const periodDays = number('pf'), frequencyPerDay = number('fund_freq1');
  // The row states the period twice; a mismatch means the columns were read from different solutions.
  if (Math.abs(periodDays * frequencyPerDay - 1) > 1e-9) throw new TypeError(`${where}: pf ${periodDays} d and fund_freq1 ${frequencyPerDay} /d disagree.`);
  return Object.freeze({ sourceId: cell('source_id'), periodDays, periodErrorDays: number('pf_error'), frequencyPerDay,
    referenceTime: number('reference_time_g'), zeroPointMag: number('zp_mag_g'),
    amplitudesMag: Object.freeze(amplitudesMag), phasesRadians: Object.freeze(phasesRadians),
    epochMaximum: number('epoch_g'), epochMaximumError: number('epoch_g_error'), peakToPeakMag: number('peak_to_peak_g'),
    r21: optional('r21_g'), phi21: optional('phi21_g'), type: cell('type_best_classification') });
}

/** G magnitude at a Gaia time: zp + sum A_k cos(2 pi k f (t - Tref) + phi_k). */
export function gaiaMagnitude(model: GaiaCepheidModel, gaiaTime: number): number {
  const angle = 2 * Math.PI * model.frequencyPerDay * (gaiaTime - model.referenceTime);
  return model.amplitudesMag.reduce((sum, amplitude, index) => sum + amplitude * Math.cos((index + 1) * angle + model.phasesRadians[index]!), model.zeroPointMag);
}

const SAMPLES_PER_PERIOD = 100_000;
/** How far epoch_g may sit from the model's peak, in periods, when its stated error is smaller (checkGaiaCepheidModel). */
const EPOCH_TOLERANCE_PERIODS = 0.001;
const wrap = (angle: number) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

export interface GaiaCepheidCheck {
  readonly brightestMag: number;
  readonly faintestMag: number;
  readonly peakToPeakMag: number;
  /** Gaia time of the model's maximum light nearest the published epoch_g. */
  readonly maximumTime: number;
}

/**
 * Evaluate the model over one period and hold it to the numbers the same row publishes: peak-to-peak (float32, 1e-4 mag),
 * the epoch of maximum (within epoch_g_error or a thousandth of a period) and, with two or more harmonics, R21 and phi21. A failure means the model
 * was read with the wrong convention or from the wrong row.
 */
export function checkGaiaCepheidModel(model: GaiaCepheidModel, where: string): GaiaCepheidCheck {
  let brightestMag = Infinity, faintestMag = -Infinity, maximumTime = Number.NaN;
  const start = model.epochMaximum - model.periodDays / 2;
  for (let index = 0; index < SAMPLES_PER_PERIOD; index++) {
    const time = start + index / SAMPLES_PER_PERIOD * model.periodDays, magnitude = gaiaMagnitude(model, time);
    if (magnitude < brightestMag) { brightestMag = magnitude; maximumTime = time; }
    if (magnitude > faintestMag) faintestMag = magnitude;
  }
  const peakToPeakMag = faintestMag - brightestMag;
  if (Math.abs(peakToPeakMag - model.peakToPeakMag) > 1e-4)
    throw new RangeError(`${where}: the harmonic model spans ${peakToPeakMag.toFixed(5)} mag but peak_to_peak_g is ${model.peakToPeakMag}.`);
  // Measured 2026-09-28 on the 57 Cepheids that carry a model: epoch_g lies at most 0.000495 of a period from the model's own
  // peak, beyond its stated error for some; a reading with the wrong phase sign misses by about a tenth of a period (S Vul 0.108).
  const epochTolerance = Math.max(model.epochMaximumError, EPOCH_TOLERANCE_PERIODS * model.periodDays);
  if (Math.abs(maximumTime - model.epochMaximum) > epochTolerance)
    throw new RangeError(`${where}: the model peaks at ${maximumTime.toFixed(4)}, ${Math.abs(maximumTime - model.epochMaximum).toFixed(4)} d from epoch_g ${model.epochMaximum} (allowed ${epochTolerance.toFixed(4)} d).`);
  if (model.amplitudesMag.length >= 2) {
    const r21 = model.amplitudesMag[1]! / model.amplitudesMag[0]!, phi21 = wrap(model.phasesRadians[1]! - 2 * model.phasesRadians[0]!);
    if (model.r21 === null || model.phi21 === null || Math.abs(r21 - model.r21) > 1e-4 || Math.abs(wrap(phi21 - model.phi21 + Math.PI) - Math.PI) > 1e-3)
      throw new RangeError(`${where}: harmonics give R21 ${r21.toFixed(5)}, phi21 ${phi21.toFixed(5)}; the row states R21 ${model.r21}, phi21 ${model.phi21}.`);
  }
  return Object.freeze({ brightestMag, faintestMag, peakToPeakMag, maximumTime });
}


export interface PulsationTrack {
  readonly durationMs: number;
  /** Veil opacity over one period, starting at the scene epoch. */
  readonly keyframes: readonly { readonly offset: number; readonly opacity: string }[];
  readonly provenance: {
    readonly source: string;
    readonly periodDays: number;
    readonly peakToPeakMag: number;
    readonly brightestMag: number;
    readonly faintestMag: number;
    readonly faintestFluxRatio: number;
    readonly sceneEpochJdTt: number;
    readonly phaseAtSceneEpoch: number;
    /** Cycles since epoch_g times the period error, in cycles: how well the phase shown at the scene epoch is known. */
    readonly phaseUncertaintyCycles: number;
    readonly secondsPerDay: number;
    readonly method: string;
  };
}

/**
 * One period as the opacity of a black veil over the disc, starting at the scene epoch. The flux ratio to maximum light,
 * 10^(-0.4 (m - m_max)), is carried to the display value that decodes to it (sRGB), so a white pixel under the veil emits
 * that fraction of its light. Keyframes are evenly spaced in phase and doubled until the interpolated value stays within
 * half an 8-bit level of the model everywhere.
 */
export function pulsationTrack(model: GaiaCepheidModel, check: GaiaCepheidCheck, sceneEpochJdTt: number, source: string, where: string): PulsationTrack {
  if (!Number.isFinite(sceneEpochJdTt)) throw new TypeError(`${where}: the scene epoch must be a finite Julian date, got ${sceneEpochJdTt}.`);
  // TT and TCB differ by seconds and the barycentric correction is at most 8.3 minutes; both are far inside the periods read here.
  const sceneTime = sceneEpochJdTt - GAIA_TIME_OFFSET_JD;
  const cycles = (sceneTime - check.maximumTime) / model.periodDays;
  const phaseAtSceneEpoch = cycles - Math.floor(cycles);
  // linearToSrgb (limb.ts) is the IEC 61966-2-1 encoding in 8-bit levels; the veil wants it as a fraction.
  const display = (phase: number) => linearToSrgb(10 ** (-0.4 * (gaiaMagnitude(model, sceneTime + phase * model.periodDays) - check.brightestMag))) / 255;
  let count = 8, frames: number[] = [];
  for (;; count *= 2) {
    frames = Array.from({ length: count + 1 }, (_, index) => display(index / count));
    let worst = 0;
    for (let index = 0; index < count; index++) for (let step = 1; step < 16; step++) {
      const t = step / 16, exact = display((index + t) / count);
      worst = Math.max(worst, Math.abs(frames[index]! + (frames[index + 1]! - frames[index]!) * t - exact));
    }
    if (worst <= DISPLAY_TOLERANCE) break;
    if (count >= 1024) throw new RangeError(`${where}: 1024 keyframes still leave ${(worst * 255).toFixed(2)} display levels of interpolation error.`);
  }
  return Object.freeze({
    durationMs: Math.round(model.periodDays * PULSATION_SECONDS_PER_DAY * 1000),
    keyframes: Object.freeze(frames.map((value, index) => Object.freeze({ offset: Number((index / count).toFixed(6)), opacity: (1 - value).toFixed(4) }))),
    provenance: Object.freeze({ source, periodDays: model.periodDays, peakToPeakMag: check.peakToPeakMag,
      brightestMag: Number(check.brightestMag.toFixed(5)), faintestMag: Number(check.faintestMag.toFixed(5)),
      faintestFluxRatio: Number((10 ** (-0.4 * check.peakToPeakMag)).toFixed(4)), sceneEpochJdTt,
      phaseAtSceneEpoch: Number(phaseAtSceneEpoch.toFixed(4)),
      phaseUncertaintyCycles: Number((Math.abs(cycles) * model.periodErrorDays / model.periodDays).toFixed(4)),
      secondsPerDay: PULSATION_SECONDS_PER_DAY,
      method: 'Gaia DR3 vari_cepheid G-band harmonic model; veil opacity 1 - sRGB(10^(-0.4 (m - m_max))), IEC 61966-2-1' }),
  });
}
