/** A planet's transit as a telescope recorded it: the host's light curves folded onto the planet's orbit and averaged in bins, shown as
 * the drop in the star's light, in parts per million, against the hours from mid-transit. The reading, detrending and folding happen
 * in preparation (`foldTransits`, objects/raster); this renders the bins it is given and keeps their spread. */
import { CHART, chartAxes, chartDocument, chartNotes, coordinate, linearScale, ticks } from './chart-style.ts';
import type { ChartIdentity } from './chart-style.ts';

export interface TransitBin { readonly hours: number; readonly ppm: number; readonly error: number; readonly samples: number }

/** Round limits and three or four ticks that hold `low` to `high` with a little room. */
function axis(low: number, high: number) {
  const pad = (high - low || 1) * .08, a = low - pad, b = high + pad, raw = (b - a) / 3;
  const power = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(f => f * power).find(value => value >= raw)!;
  const minimum = Math.floor(a / step) * step, maximum = Math.ceil(b / step) * step, values: number[] = [];
  for (let value = minimum; value <= maximum + step / 2; value += step) values.push(Number(value.toPrecision(12)));
  return { minimum, maximum, values };
}

export function renderFoldedTransit(input: ChartIdentity & { bins: readonly TransitBin[]; transits: number; notes: readonly string[] }) {
  const { bins, transits, notes } = input;
  if (bins.length < 5 || bins.some((bin, i) => ![bin.hours, bin.ppm, bin.error].every(Number.isFinite) || bin.error < 0 || i > 0 && bin.hours <= bins[i - 1]!.hours))
    throw new TypeError(`${input.id}: a folded transit needs five or more bins in time order with finite values and errors.`);
  if (notes.length > 4 || notes.some(note => note.length > 52)) throw new TypeError(`${input.id}: chart notes exceed the prepared layout.`);
  const span = Math.max(...bins.map(bin => Math.abs(bin.hours))), xs = axis(-span, span), ys = axis(Math.min(...bins.map(b => b.ppm - b.error)), Math.max(...bins.map(b => b.ppm + b.error)));
  const x = linearScale(xs.minimum, xs.maximum, CHART.left, CHART.right), y = linearScale(ys.minimum, ys.maximum, CHART.bottom, CHART.top), n = coordinate;
  const axes = chartAxes({ x, y, xTicks: ticks(xs.values), yTicks: ticks(ys.values), xLabel: 'Hours from mid-transit', yLabel: 'Change in starlight (ppm)' });
  const points = bins.map(bin => `<g class="transit-bin" data-hours="${bin.hours}" data-ppm="${bin.ppm}" data-error="${bin.error}"><path d="M${n(x(bin.hours))} ${n(y(bin.ppm + bin.error))}V${n(y(bin.ppm - bin.error))}"/><circle cx="${n(x(bin.hours))}" cy="${n(y(bin.ppm))}" r="1.6" fill="${CHART.neutral}" stroke="none"/></g>`).join('');
  return chartDocument({ ...input, metadata: { ...input.metadata, transits, bins: bins.length } },
    axes + `<g stroke="${CHART.neutral}" stroke-width=".7" fill="none">${points}</g>` + chartNotes(notes, 264), { className: 'object-folded-transit-chart', height: 260 + notes.length * 15 });
}
