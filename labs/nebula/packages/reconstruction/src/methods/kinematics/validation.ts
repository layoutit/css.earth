import type { CalibrationAnchor, KinematicParameters, PreparedKinematics, SlitEvidence, VelocityPoint } from './types.ts';
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Expected an object.'); return value;
}
function str(value: unknown): string { if (typeof value !== 'string' || !value.trim() || value.length > 8192) throw new TypeError('Expected text.'); return value; }
function num(value: unknown, min = -1e6, max = 1e6): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new TypeError(`Expected finite number in ${min}…${max}.`); return value;
}
function list<T>(value: unknown, read: (item: unknown) => T, max = 4096): T[] {
  if (!Array.isArray(value) || value.length > max) throw new TypeError('Invalid array.'); return value.map(read);
}
function hash(value: unknown): string { const v = str(value); if (!/^[a-f0-9]{64}$/.test(v)) throw new TypeError('Expected SHA-256.'); return v; }
function url(value: unknown): string { const v = str(value); if (new URL(v).protocol !== 'https:') throw new TypeError('Expected HTTPS citation.'); return v; }
function anchors(value: unknown): [CalibrationAnchor, CalibrationAnchor] {
  const v = list(value, entry => { const item = record(entry); return { pixel: num(item.pixel, 0), value: num(item.value) }; }, 2);
  if (v.length !== 2 || v[0]!.pixel === v[1]!.pixel || v[0]!.value === v[1]!.value) throw new TypeError('Invalid figure calibration.');
  return [v[0]!, v[1]!];
}
export function readKinematicParameters(value: unknown): KinematicParameters {
  const v = record(value); return { radiusArcsec: num(v.radiusArcsec, 30, 300), inclinationDegrees: num(v.inclinationDegrees, -80, 80),
    depthRatio: num(v.depthRatio, .25, 3), expansionKmS: num(v.expansionKmS, 1, 40) };
}
export function readSlitEvidence(value: unknown): SlitEvidence {
  const v = record(value), c = record(v.citation), f = record(v.figure), s = record(v.slit), y = record(v.systemic), t = record(v.textCrossCheck);
  if (v.schema !== 'cssearth-slit-evidence@1' || s.offsetUnit !== 'arcsec' || s.velocityUnit !== 'km/s' ||
      s.velocityFrame !== 'heliocentric' || s.positiveVelocity !== 'receding') throw new TypeError('Unsupported slit schema or velocity frame.');
  const width = num(f.width, 1, 16384), height = num(f.height, 1, 16384);
  const samples = list(v.samples, entry => { const p = record(entry); return { id: str(p.id), pixelX: num(p.pixelX, 0, width), pixelY: num(p.pixelY, 0, height) }; });
  if (!samples.length || new Set(samples.map(p => p.id)).size !== samples.length) throw new TypeError('Missing or duplicate observed points.');
  const offsetCalibration = anchors(f.offsetCalibration), velocityCalibration = anchors(f.velocityCalibration);
  if (offsetCalibration.some(p => p.pixel > width) || velocityCalibration.some(p => p.pixel > height)) throw new TypeError('Calibration lies outside the source raster.');
  return { schema: v.schema, id: str(v.id), title: str(v.title),
    citation: { label: str(c.label), url: url(c.url), pdfUrl: url(c.pdfUrl), sourceUrl: url(c.sourceUrl),
      sourceArchiveSha256: hash(c.sourceArchiveSha256), member: str(c.member), memberSha256: hash(c.memberSha256), figureSha256: hash(c.figureSha256) },
    figure: { width, height, cachePath: str(f.cachePath), extraction: str(f.extraction), pixelConvention: str(f.pixelConvention),
      offsetCalibration, velocityCalibration, readoutUncertaintyPixels: num(f.readoutUncertaintyPixels, .1, 10), readoutNote: str(f.readoutNote) },
    slit: { direction: str(s.direction), offsetUnit: s.offsetUnit, velocityUnit: s.velocityUnit, velocityFrame: s.velocityFrame, positiveVelocity: s.positiveVelocity,
      lengthArcsec: num(s.lengthArcsec, 1, 3600), widthArcsec: num(s.widthArcsec, .01, 60), integrationSeconds: num(s.integrationSeconds, 1, 1e6),
      spatialBinArcsec: num(s.spatialBinArcsec, .01, 60), instrumentalWidthKmS: num(s.instrumentalWidthKmS, .1, 100), instrumentNote: str(s.instrumentNote) },
    systemic: { valueKmS: num(y.valueKmS, -500, 500), uncertaintyKmS: num(y.uncertaintyKmS, 0, 100), source: str(y.source) },
    defaults: readKinematicParameters(v.defaults), defaultEvidence: list(v.defaultEvidence, str, 20), limitations: list(v.limitations, str, 30),
    textCrossCheck: { offsetArcsec: num(t.offsetArcsec), velocitiesHeliocentricKmS: list(t.velocitiesHeliocentricKmS, item => num(item, -500, 500), 20), source: str(t.source) }, samples };
}
/** Transport validation only: the browser never computes the forward model or chart. */
export function readPreparedKinematics(value: unknown): PreparedKinematics {
  const v = record(value), c = record(v.chart), m = record(v.metrics);
  if (v.schema !== 'cssearth-kinematics-comparison@1') throw new TypeError('Invalid kinematics result.');
  const path = (p: unknown) => { if (typeof p !== 'string' || p.length > 100000 || !/^[ML\d\s.,e+\-]*$/.test(p)) throw new TypeError('Invalid prepared curve.'); return p; };
  const tick = (p: unknown) => { const t = record(p); return { value: num(t.value), position: num(t.position, 0, 2048) }; };
  const point = (p: unknown): VelocityPoint => { const t = record(p); return { id: str(t.id), offsetArcsec: num(t.offsetArcsec), heliocentricKmS: num(t.heliocentricKmS),
    relativeKmS: num(t.relativeKmS), cx: num(t.cx, 0, 2048), cy: num(t.cy, 0, 2048) }; };
  const result: PreparedKinematics = { schema: v.schema, evidenceSha256: hash(v.evidenceSha256), evidence: readSlitEvidence(v.evidence), parameters: readKinematicParameters(v.parameters),
    chart: { width: num(c.width, 100, 2048), height: num(c.height, 100, 2048), left: num(c.left, 0, 2048), right: num(c.right, 0, 2048),
      top: num(c.top, 0, 2048), bottom: num(c.bottom, 0, 2048), xTicks: list(c.xTicks, tick, 30), yTicks: list(c.yTicks, tick, 30),
      systemicBandTop: num(c.systemicBandTop, 0, 2048), systemicBandHeight: num(c.systemicBandHeight, 0, 2048), zeroY: num(c.zeroY, 0, 2048), zeroX: num(c.zeroX, 0, 2048),
      points: list(c.points, point), approachingPath: path(c.approachingPath), recedingPath: path(c.recedingPath) },
    metrics: { nearestSurfaceRmsKmS: m.nearestSurfaceRmsKmS === null ? null : num(m.nearestSurfaceRmsKmS, 0), comparedPoints: num(m.comparedPoints, 0, 4096),
      outsideProjectedShell: num(m.outsideProjectedShell, 0, 4096), centralApproachingKmS: num(m.centralApproachingKmS), centralRecedingKmS: num(m.centralRecedingKmS),
      offsetReadoutArcsec: num(m.offsetReadoutArcsec, 0), velocityReadoutKmS: num(m.velocityReadoutKmS, 0) } };
  if (result.chart.points.length !== result.evidence.samples.length || result.chart.points.some((p, i) => p.id !== result.evidence.samples[i]!.id))
    throw new TypeError('Prepared result omitted or reordered measurements.');
  return result;
}
