import { CHART, chartAxes, chartDocument, chartLine, chartNotes, coordinate, escapeXml, linearScale, ticks } from './chart-style.ts';
import type { ChartIdentity } from './chart-style.ts';
export type { ChartIdentity } from './chart-style.ts';
export interface ReflectancePoint { wavelength: number; total: number }
export interface PressureLayer { pressure: number; temperature: number }
export interface PhasePoint { phaseAngle: number; dimmingMagnitude: number }
export interface LightCurvePoint { hours: number; flux: number }
export interface LightCurveEvent { hours: number; label: string }

export function renderReflectanceChart(input: ChartIdentity & { points: readonly ReflectancePoint[]; maximum: number }) {
  const { points, maximum } = input;
  if (!Array.isArray(points) || points.length < 2 || points.some((p, i) => !Number.isFinite(p.wavelength) || !Number.isFinite(p.total) || p.total < 0 || p.total > maximum ||
      i > 0 && p.wavelength <= points[i - 1].wavelength) || !Number.isFinite(maximum) || maximum <= 0) throw new TypeError('Reflectance chart data is incompatible.');
  const first = points[0].wavelength, last = points.at(-1)!.wavelength;
  if (first > .35 || last < .78 || last > 1.01) throw new RangeError('Reflectance chart wavelength range is incompatible.');
  const x = linearScale(first, last, CHART.left, CHART.right), y = linearScale(0, maximum, CHART.bottom, CHART.top);
  // Illustrative 380–780 nm visible region, not a sharp physical boundary:
  // https://cie.co.at/eilvterm/17-21-003 says the limits depend on flux and observer.
  const regions = [{ start: first, end: .38, label: 'UV', color: CHART.purple },
    { start: .38, end: .78, label: 'Visible', color: CHART.green }, { start: .78, end: last, label: 'Near-IR', color: CHART.amber }];
  const shading = regions.map(r => `<rect x="${coordinate(x(r.start))}" y="29" width="${coordinate(x(r.end) - x(r.start))}" height="174" fill="${r.color}" fill-opacity=".07"/>`).join('');
  const legend = `<path d="M0 245H19" stroke="${CHART.neutral}" stroke-width="1.5"/><text x="26" y="249">Reflectance</text><text x="0" y="274">Shading · approx.</text>` +
    regions.map((r, i) => `<rect x="${100 + i * 70}" y="267" width="10" height="7" fill="${r.color}" fill-opacity=".5"/><text x="${115 + i * 70}" y="274">${r.label}</text>`).join('');
  const axes = chartAxes({ x, y, xTicks: [first, .5, .75, last].map(value => ({ value, label: String(Math.round(value * 1000)) })),
    yTicks: ticks([0, maximum / 2, maximum]), xLabel: 'Wavelength (nm)', yLabel: 'Reflectance (I/F)' });
  return chartDocument({ ...input, description: `${input.description} Background shading marks approximate wavelength regions, with illustrative boundaries at 380 and 780 nm.` }, shading + axes + chartLine(points.map(p => ({ x: x(p.wavelength), y: y(p.total) })), CHART.neutral) + legend,
    { className: 'object-reflectance-chart', height: 289 });
}

export function renderTemperaturePressureChart(input: ChartIdentity & {
  layers: readonly PressureLayer[]; pressureMinimum: number; pressureMaximum: number; temperatureMinimum: number; temperatureMaximum: number;
  pressureTicks: readonly { pressure: number; label: string }[];
}) {
  const { layers, pressureMinimum, pressureMaximum, temperatureMinimum, temperatureMaximum, pressureTicks } = input;
  if (!Array.isArray(layers) || layers.length < 2 || !(pressureMinimum > 0 && pressureMaximum > pressureMinimum && temperatureMaximum > temperatureMinimum) ||
      layers.some(p => !Number.isFinite(p.pressure) || !Number.isFinite(p.temperature) || p.pressure < pressureMinimum || p.pressure > pressureMaximum ||
        p.temperature < temperatureMinimum || p.temperature > temperatureMaximum) || !Array.isArray(pressureTicks) || !pressureTicks.length ||
      pressureTicks.some(t => t.pressure < pressureMinimum || t.pressure > pressureMaximum || !Number.isFinite(t.pressure) || typeof t.label !== 'string'))
    throw new TypeError('Temperature-pressure chart data is incompatible.');
  const x = linearScale(temperatureMinimum, temperatureMaximum, CHART.left, CHART.right);
  const logY = linearScale(Math.log(pressureMinimum), Math.log(pressureMaximum), CHART.top, CHART.bottom), y = (p: number) => logY(Math.log(p));
  const axes = chartAxes({ x, y, xTicks: ticks([temperatureMinimum, (temperatureMinimum + temperatureMaximum) / 2, temperatureMaximum]),
    yTicks: pressureTicks.map(t => ({ value: t.pressure, label: t.label })), xLabel: 'Temperature (K)', yLabel: 'Pressure (bar)', direction: 'Higher atmosphere ↑' });
  return chartDocument(input, axes + chartLine(layers.map(p => ({ x: x(p.temperature), y: y(p.pressure) }))) +
    chartNotes([`Atmospheric model · ${layers.length} layers.`]), { className: 'object-temperature-pressure-chart' });
}

export function renderPhotometricPhaseChart(input: ChartIdentity & { points: readonly PhasePoint[] }) {
  const { points } = input;
  if (!Array.isArray(points) || points.length < 3 || points[0].phaseAngle !== 0 || points.some((p, i) => !Number.isFinite(p.phaseAngle) || p.phaseAngle < 0 || p.phaseAngle > 180 ||
      !Number.isFinite(p.dimmingMagnitude) || i > 0 && p.phaseAngle <= points[i - 1].phaseAngle)) throw new TypeError('Photometric phase chart data is incompatible.');
  const last = points.at(-1)!.phaseAngle, values = points.map(p => p.dimmingMagnitude), minimum = Math.min(...values), maximum = Math.max(...values);
  if (!(maximum > minimum)) throw new RangeError('Photometric phase chart has no brightness range.');
  const x = linearScale(0, last, CHART.left, CHART.right), y = linearScale(minimum, maximum, CHART.top, CHART.bottom);
  const axes = chartAxes({ x, y, xTicks: ticks([0, last / 2, last]), yTicks: ticks([0, maximum / 2, maximum]),
    xLabel: 'Phase angle (°)', yLabel: 'V-band dimming (mag)', direction: 'Fainter ↓' });
  return chartDocument(input, axes + chartLine(points.map(p => ({ x: x(p.phaseAngle), y: y(p.dimmingMagnitude) }))) +
    chartNotes(['Relative to phase angle 0°.']), { className: 'object-photometric-phase-chart' });
}

/** Preserve the supplied binned values and event positions; this renderer performs no time-series reduction. */
export function renderLightCurveChart(input: ChartIdentity & { points: readonly LightCurvePoint[]; events: readonly LightCurveEvent[]; axisLabel: string }) {
  const { points, events, axisLabel } = input;
  if (!Array.isArray(points) || points.length < 3 || points[0].hours !== 0 || typeof axisLabel !== 'string' || !axisLabel ||
      points.some((p, i) => !Number.isFinite(p.hours) || !Number.isFinite(p.flux) || i > 0 && p.hours <= points[i - 1].hours) ||
      !Array.isArray(events) || events.some(e => !Number.isFinite(e.hours) || typeof e.label !== 'string' || !e.label)) throw new TypeError('Light curve chart data is incompatible.');
  const last = points.at(-1)!.hours, values = points.map(p => p.flux), minimum = Math.min(...values), maximum = Math.max(...values);
  if (!(maximum > minimum)) throw new RangeError('Light curve chart has no brightness range.');
  const x = linearScale(0, last, CHART.left, CHART.right), y = linearScale(minimum, maximum, CHART.bottom, CHART.top);
  const axes = chartAxes({ x, y, xTicks: ticks([0, last / 2, last]), yTicks: ticks([...new Set([minimum, ...(minimum < 0 && maximum > 0 ? [0] : [(minimum + maximum) / 2]), maximum])]), xLabel: axisLabel, yLabel: 'Relative flux (ppm)' });
  const markers = events.filter(e => e.hours >= 0 && e.hours <= last).map(e => `<path d="M${coordinate(x(e.hours))} 29V203" stroke="${CHART.amber}" stroke-opacity=".3" stroke-dasharray="2 3"/><text x="${coordinate(x(e.hours))}" y="25" text-anchor="middle" fill="${CHART.amber}">${escapeXml(e.label)}</text>`).join('');
  return chartDocument(input, axes + markers + chartLine(points.map(p => ({ x: x(p.hours), y: y(p.flux) }))) +
    chartNotes(['Relative to the median flux.', 'Dashed lines mark the named events.']), { className: 'object-light-curve-chart', height: 290 });
}
