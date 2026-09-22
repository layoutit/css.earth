// Node-only, source-owned geometric snapshots. Never evaluate them at another epoch.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseBodyEpochRecord, parsePublishedParameters } from './lib/ephemeris-records.mts';
import type { PublishedRecord, PublishedParameters, SourcePin, HorizonsPin, ProjectionSample } from './lib/ephemeris-records.mts';
import { numberVector } from './lib/generator-records.mts';
interface BodyEpochRequest { bodyRoot: string; bodyId: string; centerBodyId: string; target: number | null; center: number | null; epochJdTt: number }
/** Read a retained, independently center-checked Horizons state for one body. */
export async function loadBodyEpochEphemeris({ bodyRoot, bodyId, centerBodyId, target, center, epochJdTt }: BodyEpochRequest) {
  const path = resolve(bodyRoot, 'source/validation/epoch-state.json');
  const record = parseBodyEpochRecord(JSON.parse(await readFile(path, 'utf8')));
  if (record.schema === 'cssearth-published-body-epoch-ephemeris@1') {
    return loadPublishedRecord({ record, bodyRoot, bodyId, centerBodyId, epochJdTt });
  }
  if (record.schema !== 'cssearth-body-epoch-ephemeris@1' || record.id !== bodyId ||
      record.centerBodyId !== centerBodyId || record.epochJdTt !== epochJdTt ||
      record.referenceFrame !== 'ICRF' || record.units !== 'KM-D' || record.correction !== 'NONE' ||
      record.runtimeExtrapolation !== false || record.ttMinusUtcSeconds !== 69.184 ||
      !Number.isFinite(record.requestEpochJdUtc) || !Number.isFinite(epochJdTt) ||
      !Number.isSafeInteger(target) || !Number.isSafeInteger(center) ||
      Math.abs(record.requestEpochJdUtc + record.ttMinusUtcSeconds / 86400 - epochJdTt) > 1e-9) {
    throw new TypeError(`Body ephemeris identity, epoch or convention differs: ${bodyId}.`);
  }
  const requestEpochJdUtc = record.requestEpochJdUtc;
  const relative = await readSource(record.sources?.relative, target, center);
  const parent = await readSource(record.sources?.parent, center, 10);
  const heliocentric = await readSource(record.sources?.heliocentricCheck, target, 10);
  assertVector(record.positionKm, relative.positionKm, 'relative position');
  assertVector(record.velocityKmPerDay, relative.velocityKmPerDay, 'relative velocity');
  assertVector(record.parentHeliocentricState?.positionKm, parent.positionKm, 'parent position');
  assertVector(record.parentHeliocentricState?.velocityKmPerDay, parent.velocityKmPerDay, 'parent velocity');
  const gm = record.gravitationalParametersKm3PerS2;
  if (!gm || gm.body !== relative.gm || gm.parent !== parent.gm ||
      gm.combined !== gm.body + gm.parent || !(gm.combined > 0)) {
    throw new TypeError(`Body ephemeris gravity differs from source headers: ${bodyId}.`);
  }
  const positionResidual = heliocentric.positionKm.map((value, i) => value - parent.positionKm[i] - relative.positionKm[i]);
  const velocityResidual = heliocentric.velocityKmPerDay.map((value, i) => value - parent.velocityKmPerDay[i] - relative.velocityKmPerDay[i]);
  if (positionResidual.some(value => Math.abs(value) > 1e-5) || velocityResidual.some(value => Math.abs(value) > 1e-8)) {
    throw new TypeError(`Body ephemeris independent center composition differs: ${bodyId}.`);
  }
  const provenance = (source: HorizonsPin) => Object.freeze({ model: 'Horizons geometric state at prepared epoch',
    epochJdTt, referenceFrame: 'ICRF', target: source.target, center: source.center,
    source: source.url, sourcePath: `src/objects/${bodyId}/${source.path}`,
    solution: record.solution, limitations: record.limitations,
    timeQualification: 'UTC request converted to the exact TT scene epoch using TT−UTC = 69.184 s; no extrapolation.' });
  return Object.freeze({ epochJdTt, positionKm: Object.freeze(relative.positionKm), velocityKmPerDay: Object.freeze(relative.velocityKmPerDay),
    centerBodyId, gravitationalParametersKm3PerS2: Object.freeze({ ...gm }),
    systemGmKm3PerS2: gm.combined,
    parentHeliocentricState: Object.freeze({ positionKm: Object.freeze(parent.positionKm),
      velocityKmPerDay: Object.freeze(parent.velocityKmPerDay), provenance: provenance(record.sources.parent) }),
    provenance: provenance(record.sources.relative) });

  async function readSource(source: HorizonsPin, expectedTarget: number | null, expectedCenter: number | null) {
    if (!source || source.target !== expectedTarget || source.center !== expectedCenter ||
        !/^source\/orbit\/[a-z0-9-]+\.txt$/u.test(source.path ?? '')) {
      throw new TypeError(`Body ephemeris source identity/path differs: ${bodyId}.`);
    }
    const url = new URL(source.url);
    const query = url.searchParams;
    const fields = { COMMAND: String(expectedTarget), CENTER: `500@${expectedCenter}`, EPHEM_TYPE: 'VECTORS',
      TIME_TYPE: 'UT', REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', OUT_UNITS: 'KM-D', VEC_CORR: 'NONE',
      VEC_TABLE: '2', CSV_FORMAT: 'YES', TLIST_TYPE: 'JD' };
    if (url.origin !== 'https://ssd.jpl.nasa.gov' || url.pathname !== '/api/horizons.api' ||
        Object.entries(fields).some(([key, value]) => query.get(key) !== value) ||
        !Number.isFinite(Number(query.get('TLIST'))) ||
        Math.abs(Number(query.get('TLIST')) - requestEpochJdUtc) > 1e-9) {
      throw new TypeError(`Body ephemeris request convention differs: ${bodyId}.`);
    }
    const bytes = await readFile(resolve(bodyRoot, source.path));
    if (bytes.length !== source.bytes) {
      throw new TypeError(`Body ephemeris source length differs: ${bodyId}.`);
    }
    const text = bytes.toString('utf8');
    const responseTarget = text.match(/^Target body name:.*\((\d+)\)/m)?.[1];
    const responseCenter = text.match(/^Center body name:.*\((\d+)\)/m)?.[1];
    if (Number(responseTarget) !== expectedTarget || Number(responseCenter) !== expectedCenter ||
        !/^Center-site name:\s+BODY CENTER\s*$/m.test(text) ||
        !/^Output units\s+: KM-D\s*$/m.test(text) ||
        !/^Output type\s+: GEOMETRIC cartesian states\s*$/m.test(text) ||
        !/^Reference frame\s+: ICRF\s*$/m.test(text) || !/Calendar Date \(UT\s*\)/.test(text)) {
      throw new TypeError(`Body ephemeris response convention differs: ${bodyId}.`);
    }
    const lines = text.split('$$SOE')[1]?.split('$$EOE')[0]?.trim().split('\n');
    if (lines?.length !== 1) throw new TypeError(`Body ephemeris requires one state: ${bodyId}.`);
    const fieldsCsv = lines[0].split(',').map(value => value.trim());
    const values = fieldsCsv.slice(2, 8).map(Number);
    const sourceGm = Number(text.match(/^\s+GM=\s+([\d.]+)\s/m)?.[1]);
    if (Math.abs(Number(fieldsCsv[0]) - requestEpochJdUtc) > 1e-9 ||
        !Number.isFinite(Number(fieldsCsv[0])) ||
        values.length !== 6 || values.some(value => !Number.isFinite(value)) || !Number.isFinite(sourceGm)) {
      throw new TypeError(`Body ephemeris response epoch/components/gravity differ: ${bodyId}.`);
    }
    return { positionKm: numberVector(values.slice(0, 3)), velocityKmPerDay: numberVector(values.slice(3)), gm: sourceGm };
  }
}

async function loadPublishedRecord({ record, bodyRoot, bodyId, centerBodyId, epochJdTt }: Omit<BodyEpochRequest, 'target' | 'center'> & { record: PublishedRecord }) {
  if (record.id !== bodyId || record.centerBodyId !== centerBodyId || record.epochJdTt !== epochJdTt ||
      record.referenceFrame !== 'ICRF' || record.units !== 'KM-D' || record.correction !== 'NONE' ||
      record.runtimeExtrapolation !== false || !Array.isArray(record.limitations) || !record.limitations.length ||
      !/^source\/orbit\/[a-z0-9-]+\.json$/u.test(record.source?.path ?? '')) {
    throw new TypeError(`Published body ephemeris identity, epoch or convention differs: ${bodyId}.`);
  }
  const bytes = await readFile(resolve(bodyRoot, record.source.path));
  if (bytes.length !== record.source.bytes) {
    throw new TypeError(`Published body ephemeris source length differs: ${bodyId}.`);
  }
  const parameters = parsePublishedParameters(JSON.parse(bytes.toString('utf8')));
  if (parameters.schema !== 'cssearth-published-mutual-orbit@1' || parameters.id !== bodyId ||
      parameters.centerBodyId !== centerBodyId || typeof parameters.timeQualification !== 'string' ||
      !parameters.timeQualification.trim() || !parameters.citation || !record.validation) {
    throw new TypeError(`Published body ephemeris source identity/qualification differs: ${bodyId}.`);
  }
  const computed = evaluatePublishedOrbit(parameters, epochJdTt);
  for (const key of ['positionKm', 'velocityKmPerDay'] as const) {
    if (!Array.isArray(record[key]) || record[key].length !== 3 ||
        record[key].some((value, i) => !Number.isFinite(value) || Math.abs(value - computed[key][i]) > 1e-7)) {
      throw new TypeError(`Published body ephemeris ${key} differs from its source model: ${bodyId}.`);
    }
  }
  if (parameters.independentPlaneReference) {
    const reference = parameters.independentPlaneReference;
    const r = computed.positionKm; const v = computed.velocityKmPerDay;
    const normal = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
    const length = Math.hypot(...normal);
    const ra = reference.poleIcrfRightAscensionDegrees * Math.PI / 180;
    const dec = reference.poleIcrfDeclinationDegrees * Math.PI / 180;
    const pole = [Math.cos(ra) * Math.cos(dec), Math.sin(ra) * Math.cos(dec), Math.sin(dec)];
    const angle = Math.acos(Math.max(-1, Math.min(1, normal.reduce((sum, value, i) => sum + value * pole[i] / length, 0)))) * 180 / Math.PI;
    if (!Number.isFinite(angle) || angle > 7 || typeof record.validation.orbitalPlaneVsIndependentRadarDegrees !== 'number' || !Number.isFinite(record.validation.orbitalPlaneVsIndependentRadarDegrees) ||
        Math.abs(angle - record.validation.orbitalPlaneVsIndependentRadarDegrees) > 1e-8) {
      throw new TypeError(`Published body ephemeris independent orbital plane differs: ${bodyId}.`);
    }
  }
  if (record.validation.sourceEpochState) {
    const sourceEpoch = evaluatePublishedOrbit(parameters, parameters.epochJd);
    for (const key of ['positionKm', 'velocityKmPerDay'] as const) {
      if (!Array.isArray(record.validation.sourceEpochState[key]) || record.validation.sourceEpochState[key].length !== 3 ||
          record.validation.sourceEpochState[key].some((value, i) => !Number.isFinite(value) || Math.abs(value - sourceEpoch[key][i]) > 1e-7)) {
        throw new TypeError(`Published body ephemeris source epoch anchor differs: ${bodyId}.`);
      }
    }
  }
  const gm = record.gravitationalParametersKm3PerS2;
  const expectedGm = parameters.semiMajorAxisKm ** 3 * (parameters.meanMotionDegreesPerDay * Math.PI / 180 / 86400) ** 2;
  if (!gm || !(gm.body >= 0) || !(gm.parent > 0) || gm.combined !== gm.body + gm.parent ||
      Math.abs(gm.combined / expectedGm - 1) > 1e-10) {
    throw new TypeError(`Published body ephemeris effective orbit gravity differs: ${bodyId}.`);
  }
  const sources = new Map<string, string>();
  for (const [key, source] of Object.entries(record.sourcePins ?? {})) {
    sources.set(key, await readPinnedText(bodyRoot, source));
  }
  let parentHeliocentricState;
  if (record.parentHeliocentricState || record.parentHeliocentricSource) {
    const source = record.parentHeliocentricSource;
    if (!source || !record.parentHeliocentricState) throw new TypeError("Published parent ephemeris source/state must be supplied together.");
    const text = await readPinnedText(bodyRoot, source);
    if (source.targetKind !== 'numbered-asteroid' || source.center !== 10 ||
        !Number.isFinite(source.requestEpochJdUtc) || source.ttMinusUtcSeconds !== 69.184 ||
        Math.abs(source.requestEpochJdUtc + source.ttMinusUtcSeconds / 86400 - epochJdTt) > 1e-9) {
      throw new TypeError(`Published parent ephemeris epoch/identity differs: ${bodyId}.`);
    }
    const rows = numberedAsteroidRows(source, text, source.target, 10, 'NONE');
    if (rows.length !== 1 || Math.abs(rows[0].epochJdUtc - source.requestEpochJdUtc) > 1e-9) {
      throw new TypeError(`Published parent ephemeris needs one exact state: ${bodyId}.`);
    }
    assertVector(record.parentHeliocentricState.positionKm, rows[0].positionKm, 'published parent position');
    assertVector(record.parentHeliocentricState.velocityKmPerDay, rows[0].velocityKmPerDay, 'published parent velocity');
    parentHeliocentricState = Object.freeze({ positionKm: Object.freeze(rows[0].positionKm),
      velocityKmPerDay: Object.freeze(rows[0].velocityKmPerDay), provenance: Object.freeze({
        model: 'Horizons numbered-asteroid geometric state at prepared epoch', epochJdTt, referenceFrame: 'ICRF',
        target: source.target, targetKind: source.targetKind, center: 10, source: source.url,
        sourcePath: `src/objects/${bodyId}/${source.path}`,
        qualification: record.limitations }) });
  }
  if (record.validation.comparisons) verifyPublishedProjections(parameters, record, sources);
  return Object.freeze({ epochJdTt, positionKm: Object.freeze(computed.positionKm),
    velocityKmPerDay: Object.freeze(computed.velocityKmPerDay), centerBodyId,
    gravitationalParametersKm3PerS2: Object.freeze({ ...gm }), systemGmKm3PerS2: gm.combined,
    ...(parentHeliocentricState ? { parentHeliocentricState } : {}),
    provenance: Object.freeze({ model: parameters.placement === 'approximate'
      ? 'Illustrative phase at prepared epoch using published orbital constraints'
      : 'Published mutual-orbit model evaluated once at prepared epoch', epochJdTt,
      ...(parameters.placement === 'approximate' ? { placement: 'approximate' } : {}),
      referenceFrame: 'ICRF', source: parameters.citation.url, sourcePath: `src/objects/${bodyId}/${record.source.path}`,
      timeQualification: parameters.timeQualification,
      limitations: record.limitations, validation: record.validation }) });
}

async function readPinnedText(bodyRoot: string, source: SourcePin) {
  if (!/^source\/orbit\/[a-z0-9-]+\.(?:txt|xml|dat)$/u.test(source?.path ?? '')) {
    throw new TypeError('Published ephemeris evidence path differs.');
  }
  const bytes = await readFile(resolve(bodyRoot, source.path));
  if (bytes.length !== source.bytes) {
    throw new TypeError('Published ephemeris evidence length differs.');
  }
  return bytes.toString('utf8');
}

function numberedAsteroidRows(source: SourcePin, text: string, target: number, center: number, correction: 'NONE' | 'LT') {
  if (!Number.isSafeInteger(target) || !(target > 0)) throw new TypeError('Numbered asteroid identity is invalid.');
  const url = new URL(source.url);
  const fields = { COMMAND: `${target};`, EPHEM_TYPE: 'VECTORS', TIME_TYPE: 'UT', REF_PLANE: 'FRAME',
    REF_SYSTEM: 'ICRF', OUT_UNITS: 'KM-D', VEC_TABLE: '3', CSV_FORMAT: 'YES', TLIST_TYPE: 'JD',
    CENTER: `500@${center}`, VEC_CORR: correction };
  const output = correction === 'NONE' ? 'GEOMETRIC' : 'LT CORRECTED';
  if (url.origin !== 'https://ssd.jpl.nasa.gov' || url.pathname !== '/api/horizons.api' ||
      Object.entries(fields).some(([key, value]) => url.searchParams.get(key) !== value) ||
      !new RegExp(`^Target body name:\\s+${target}\\s`, 'm').test(text) ||
      Number(text.match(/^Center body name:.*\((\d+)\)/m)?.[1]) !== center ||
      !/^Center-site name:\s+BODY CENTER\s*$/m.test(text) ||
      !/^Reference frame\s+: ICRF\s*$/m.test(text) || !/^Output units\s+: KM-D\s*$/m.test(text) ||
      !new RegExp(`^Output type\\s+: ${output} cartesian states\\s*$`, 'm').test(text) ||
      !/Calendar Date \(UT\s*\)/.test(text)) throw new TypeError('Numbered asteroid response/query convention differs.');
  const epochs = (url.searchParams.get('TLIST') ?? '').split(/\s+/u).map(Number);
  const lines = text.split('$$SOE')[1]?.split('$$EOE')[0]?.trim().split('\n');
  if (!lines?.length || lines.length !== epochs.length) throw new TypeError('Numbered asteroid epoch rows differ.');
  return lines.map((line, index) => {
    const fields = line.split(',').map(value => value.trim());
    const epochJdUtc = Number(fields[0]);
    const values = fields.slice(2, 11).map(Number);
    if (!Number.isFinite(epochJdUtc) || !Number.isFinite(epochs[index]) || Math.abs(epochJdUtc - epochs[index]) > 1e-9 ||
        values.length !== 9 || values.some(value => !Number.isFinite(value))) throw new TypeError('Numbered asteroid epoch/components differ.');
    return { epochJdUtc, positionKm: numberVector(values.slice(0, 3)), velocityKmPerDay: numberVector(values.slice(3, 6)), lightTimeDays: values[6] };
  });
}

function verifyPublishedProjections(parameters: PublishedParameters, record: PublishedRecord, sources: Map<string, string>) {
  const validation = record.validation;
  const sourcePins = record.sourcePins;
  if (!sourcePins || !parameters.sourceObservations) throw new TypeError("Published projection source pins/observations are missing.");
  const requiredSource = (key: string) => { const text = sources.get(key); if (text === undefined || !sourcePins[key]) throw new TypeError(`Missing projection source ${key}`); return text; };
  const target = record.parentHeliocentricSource?.target;
  if (!Array.isArray(validation.comparisons) || validation.comparisonCount !== validation.comparisons.length ||
      validation.comparisons.length < 2 || !target) throw new TypeError('Published ephemeris projection evidence is incomplete.');
  const close = (a: number | null | undefined, b: number | null | undefined, tolerance = .00001) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tolerance;
  const project = (comparison: ProjectionSample, sourceKey: string, jdUtc: number) => {
    const rows = numberedAsteroidRows(sourcePins[sourceKey], requiredSource(sourceKey), target, 399, 'LT');
    const row = rows.find(value => close(value.epochJdUtc, jdUtc, 1e-9));
    if (!row || !close(row.lightTimeDays, comparison.geocentricLightTimeDays, 1e-12)) throw new TypeError('Published projection observer epoch/light time differs.');
    const r = row.positionKm; const range = Math.hypot(...r); const xy = Math.hypot(r[0], r[1]);
    const east = [-r[1] / xy, r[0] / xy, 0];
    const north = [-r[0] * r[2] / range / xy, -r[1] * r[2] / range / xy, xy / range];
    const state = evaluatePublishedOrbit(parameters, comparison.epochJdTt - row.lightTimeDays);
    return [east, north].map(axis => state.positionKm.reduce((sum, value, i) => sum + value * axis[i], 0) / range * 180 / Math.PI * 3600000);
  };
  // Per-comparison Miriade source keys were never recorded, so only the published fit reproduction below is checked.
  const historical = validation.publishedFitReproduction;
  if (historical) {
    const lines = sources.get('paperAstrometry')?.trim().split('\n');
    const residuals = [];
    for (const comparison of historical.comparisons) {
      if (lines?.[comparison.line - 1]?.trim() !== comparison.sourceRow.trim()) throw new TypeError('Published astrometry row differs.');
      const fields = comparison.sourceRow.split(/\s+/u);
      const reported = [Number(fields[5]) - Number(fields[7]), Number(fields[6]) - Number(fields[8])];
      if (!reported.every((value, i) => close(value, comparison.reportedModelPositionMas[i]))) throw new TypeError('Published astrometry coordinate interpretation differs.');
      const projected = project(comparison, 'geocentricAstrometry', comparison.jdUtc);
      if (!projected.every((value, i) => close(value, comparison.publishedPrintedElementsPositionMas[i]))) throw new TypeError('Published historical projection differs.');
      residuals.push(Math.hypot(...projected.map((value, i) => value - reported[i])));
    }
    if (historical.comparisonCount !== residuals.length || !close(Math.max(...residuals), historical.maxDifferenceMas)) {
      throw new TypeError('Published historical disagreement limits differ.');
    }
  }
}

/** Preparation-only Kepler elements with the published quadratic mean-anomaly term. */
export function evaluatePublishedOrbit(parameters: PublishedParameters, epochJdTt: number) {
  const keys = ['epochJd', 'semiMajorAxisKm', 'eccentricity', 'inclinationDegrees', 'ascendingNodeDegrees',
    'argumentPeriapsisDegrees', 'meanAnomalyDegrees', 'meanMotionDegreesPerDay', 'quadraticMeanAnomalyDegreesPerYear2'] as const;
  if (!Number.isFinite(epochJdTt) || keys.some(key => !Number.isFinite(parameters[key])) ||
      !(parameters.semiMajorAxisKm > 0) || !(parameters.eccentricity >= 0 && parameters.eccentricity < 1) ||
      !(parameters.meanMotionDegreesPerDay > 0) || !['EQJ2000', 'ECLIPJ2000'].includes(parameters.referenceFrame)) {
    throw new TypeError('Published mutual orbit contains unsupported elements or frame.');
  }
  const toRad = Math.PI / 180;
  const dt = epochJdTt - parameters.epochJd;
  const years = dt / 365.25;
  const drift = parameters.quadraticMeanAnomalyDegreesPerYear2;
  const mean = (parameters.meanAnomalyDegrees + parameters.meanMotionDegreesPerDay * dt + drift * years ** 2) % 360 * toRad;
  const rate = (parameters.meanMotionDegreesPerDay + 2 * drift * years / 365.25) * toRad;
  let eccentric = mean;
  const e = parameters.eccentricity;
  for (let i = 0; i < 20; i++) {
    const step = (eccentric - e * Math.sin(eccentric) - mean) / (1 - e * Math.cos(eccentric));
    eccentric -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  if (Math.abs(eccentric - e * Math.sin(eccentric) - mean) > 1e-12) throw new TypeError('Published mutual orbit failed Kepler convergence.');
  const a = parameters.semiMajorAxisKm;
  const root = Math.sqrt(1 - e * e);
  const eccentricRate = rate / (1 - e * Math.cos(eccentric));
  const position = [a * (Math.cos(eccentric) - e), a * root * Math.sin(eccentric), 0];
  const velocity = [-a * Math.sin(eccentric) * eccentricRate, a * root * Math.cos(eccentric) * eccentricRate, 0];
  const rotateX = ([x, y, z]: readonly number[], angle: number) => [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)];
  const rotateZ = ([x, y, z]: readonly number[], angle: number) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
  const rotate = (vector: readonly number[]) => {
    const orbital = rotateZ(rotateX(rotateZ(vector, parameters.argumentPeriapsisDegrees * toRad),
      parameters.inclinationDegrees * toRad), parameters.ascendingNodeDegrees * toRad);
    // IAU 1976 J2000 mean obliquity, matching the source's ecliptic/equinox convention.
    return parameters.referenceFrame === 'ECLIPJ2000' ? rotateX(orbital, 84381.448 / 3600 * toRad) : orbital;
  };
  return { positionKm: numberVector(rotate(position)), velocityKmPerDay: numberVector(rotate(velocity)) };
}

function assertVector(actual: unknown, expected: readonly number[], label: string) {
  if (!Array.isArray(actual) || actual.length !== 3 || actual.some((value, i) => value !== expected[i])) {
    throw new TypeError(`Body ephemeris ${label} differs from retained source.`);
  }
}
