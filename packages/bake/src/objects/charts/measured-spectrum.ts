import { parseMeasuredSpectrumDocument, type Measurement } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber } from '@cssearth/core';
import { CHART, chartAxes, chartDocument, chartNotes, coordinate, escapeXml, linearScale, ticks } from './chart-style.ts';

import { parseMeasuredSpectrum, type MeasuredSpectrumRecipe, type MeasurementSource } from '@cssearth/objects';
export { parseMeasuredSpectrum, type MeasuredSpectrumRecipe, type MeasurementSource } from '@cssearth/objects';
function numericRows(text: string): number[][] {
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#')).map(line => line.trim().split(/\s+/).map(token => {
    if (/^nan$/i.test(token)) return NaN;
    const value = Number(token);
    if (!Number.isFinite(value)) throw new TypeError(`Invalid spectrum number: ${token}`);
    return value;
  }));
}

/** Keeps all measured bins, including overlapping visits and signed noisy estimates. No fitting or resampling. */
export async function readMeasuredSpectrum(root: string, input: unknown) {
  const recipe = parseMeasuredSpectrum(input), source = recipe.source;
  const text = await readFile(resolve(root, source.path), 'utf8');
  let points: Measurement[];
  if (source.format === 'records') {
    points = parseMeasuredSpectrumDocument(JSON.parse(text), recipe.mode, source.yScale);
  } else {
    const c = source.columns;
    if (!c) throw new TypeError('Missing spectrum columns.');
    points = numericRows(text).map(row => {
      const x = requireFiniteNumber(row[c.x], 'wavelength'), dx = requireFiniteNumber(row[c.xError], 'bin half-width');
      if (dx < 0) throw new TypeError('Negative wavelength half-width.');
      const y = requireFiniteNumber(row[c.y], 'measurement') * source.yScale, error = requireFiniteNumber(row[c.error], 'measurement error') * source.yScale;
      return { x, xLow: x - dx, xHigh: x + dx, y, minus: error, plus: error };
    });
  }
  if (points.length !== source.expectedRows || points.some(p => p.xLow > p.x || p.xHigh < p.x || p.minus < 0 || p.plus < 0)) throw new TypeError('Measurement count, bounds or errors differ.');
  const inside = (p: Measurement) => p.xLow >= recipe.x.minimum && p.xHigh <= recipe.x.maximum && p.y - p.minus >= recipe.y.minimum && p.y + p.plus <= recipe.y.maximum;
  if (!points.every(inside)) throw new RangeError('Chart axes would clip a measurement or its uncertainty.');
  const model: { x: number; y: number | null }[] = [];
  if (recipe.model) {
    const rows = numericRows(await readFile(resolve(root, recipe.model.path), 'utf8'));
    if (rows.length !== recipe.model.expectedRows) throw new TypeError('Model row count differs.');
    rows.forEach((row, i) => {
      const x = requireFiniteNumber(row[0], 'model wavelength');
      if (row.length !== 2 || i > 0 && x <= rows[i - 1]![0]!) throw new TypeError('Model wavelengths must increase.');
      if (x < recipe.x.minimum || x > recipe.x.maximum) return;
      const y = Number.isNaN(row[1]) ? null : requireFiniteNumber(row[1], 'model value') * recipe.model!.yScale;
      if (y !== null && (y < recipe.y.minimum || y > recipe.y.maximum)) throw new RangeError('Chart axes would clip the model.');
      model.push({ x, y });
    });
    if (model.filter(p => p.y !== null).length < 2) throw new TypeError('No model samples within the chart.');
  }
  return { recipe, points, model };
}

/** Prepared SVG in the existing chart panel. Horizontal bars are wavelength coverage, vertical bars are published errors. */
export function renderMeasuredSpectrum({ recipe: r, points, model }: Awaited<ReturnType<typeof readMeasuredSpectrum>>) {
  const height = 260 + (r.model ? 17 : 0) + r.notes.length * 15;
  const x = linearScale(r.x.minimum, r.x.maximum, CHART.left, CHART.right);
  const y = linearScale(r.y.minimum, r.y.maximum, CHART.bottom, CHART.top);
  const n = coordinate;
  const line = (x1: number, y1: number, x2: number) => `M${n(x1)} ${n(y1)}H${n(x2)}`;
  const axes = chartAxes({ x, y, xTicks: ticks(r.x.ticks), yTicks: ticks(r.y.ticks), xLabel: r.x.label, yLabel: r.y.label });
  let pen = false;
  const path = model.map(p => { if (p.y === null) { pen = false; return ''; } const d = `${pen ? 'L' : 'M'}${n(x(p.x))} ${n(y(p.y))}`; pen = true; return d; }).join(' ');
  const bars = points.map(p => `<g class="measurement" data-x="${p.x}" data-y="${p.y}" data-minus="${p.minus}" data-plus="${p.plus}">
    ${r.mode === 'band' ? `<rect class="measurement-interval" x="${n(x(p.xLow))}" y="${n(y(p.y + p.plus))}" width="${n(x(p.xHigh) - x(p.xLow))}" height="${n(y(p.y - p.minus) - y(p.y + p.plus))}" fill="${CHART.neutral}" fill-opacity="${CHART.bandOpacity}" stroke="none"/>` : ''}
    <path d="${line(x(p.xLow), y(p.y), x(p.xHigh))} M${n(x(p.x))} ${n(y(p.y + p.plus))}V${n(y(p.y - p.minus))}"/>
    ${r.mode === 'points' ? `<circle cx="${n(x(p.x))}" cy="${n(y(p.y))}" r="1.7" fill="${CHART.neutral}" stroke="none"/>` : ''}</g>`).join('');
  const fit = r.model ? `<path class="published-model" d="${path}" fill="none" stroke="${CHART.amber}" stroke-width="1.5"/><path d="M0 244H19" stroke="${CHART.amber}" stroke-width="1.5"/><text x="26" y="248">${escapeXml(r.model.label)}</text>` : '';
  return chartDocument({ ...r, metadata: { ...r.metadata, measuredBins: points.length, modelSamplesShown: model.length } },
    axes + fit + `<g stroke="${CHART.neutral}" stroke-width=".7" fill="none">${bars}</g>` + chartNotes(r.notes, 264 + (r.model ? 17 : 0)), { height });
}
