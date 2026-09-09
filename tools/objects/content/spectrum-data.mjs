import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Source sampling shared by the full and compact prepared charts. */
export async function readSpectrumData(sourceDirectory, chart) {
  if (chart.source.startsWith('/') || chart.source.includes('\\') || chart.source.split('/').includes('..')) throw new TypeError('Unsafe spectrum source path.');
  const text = await readFile(resolve(sourceDirectory, chart.source), 'utf8');
  const metadata = { ...chart.metadata };
  const field = (value, path) => path.split('.').reduce((entry, key) => entry?.[key], value);
  const numbers = (value) => {
    if (!Array.isArray(value) || value.some(item => !Number.isFinite(item))) throw new TypeError('Spectrum must contain finite samples.');
    return value;
  };
  let points;
  if (chart.format === 'json-columns') {
    const source = JSON.parse(text);
    const xs = numbers(field(source, chart.xField)), ys = numbers(field(source, chart.yField));
    if (xs.length !== chart.pointCount || ys.length !== chart.pointCount ||
        chart.minimumX !== undefined && xs[0] !== chart.minimumX ||
        chart.maximumX !== undefined && xs.at(-1) !== chart.maximumX) throw new TypeError('Spectrum source sampling drifted.');
    if (chart.countField && numbers(field(source, chart.countField)).some(count => count !== chart.countValue)) throw new TypeError('Spectrum source coverage drifted.');
    for (const [name, reference] of Object.entries(chart.metadataFields ?? {})) metadata[name] = field(source, reference);
    points = ys.map((total, index) => ({ wavelength: xs[index] / (chart.xScale ?? 1), total }));
  } else if (chart.format === 'numeric-lines') {
    if (chart.requiredHeader && !text.includes(chart.requiredHeader)) throw new TypeError('Spectrum units differ.');
    points = text.split('\n').filter(line => /^\d/.test(line)).map(line => {
      const [wavelength, total] = line.trim().split(/\s+/).map(Number);
      return { wavelength, total };
    });
  } else throw new TypeError('Unknown spectrum source format.');
  if (points.length !== chart.pointCount || points.some((point, index) =>
      !Number.isFinite(point.wavelength) || !Number.isFinite(point.total) ||
      index > 0 && point.wavelength <= points[index - 1].wavelength)) throw new TypeError('Spectrum sample count or order drifted.');
  const maximum = chart.maximumRoundingScale === undefined ? chart.maximum :
    Math.ceil(Math.max(...points.map(point => point.total)) * chart.maximumRoundingScale) / chart.maximumRoundingScale;
  return { points, maximum, metadata };
}
