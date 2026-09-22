import { isArray } from '../../../src/platform/is-array.mts';
import type { ChartAssetRecipe } from './charts.ts';
import { isRecord, requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
export type SpectrumRecipe = Extract<ChartAssetRecipe['charts'][number], {kind: 'spectrum'}>;
export interface SpectrumPoint {wavelength: number; total: number;}

/** Decode the exact profile used by both prepared spectrum presentations. */
export function parseSpectrumRecipe(value: unknown): SpectrumRecipe {
  const chart = requireRecord(value, 'Spectrum recipe');
  for (const key of ['id', 'title', 'description', 'output', 'source']) {
    if (!requireString(chart[key], key).trim()) throw new TypeError(`Spectrum ${key} must be text.`);
  }
  requireRecord(chart.metadata, 'Spectrum metadata');
  if (chart.kind !== 'spectrum' || !['json-columns', 'numeric-lines'].includes(String(chart.format))) throw new TypeError('Unknown spectrum source format.');
  if (!Number.isSafeInteger(chart.pointCount) || requireFiniteNumber(chart.pointCount, 'Spectrum point count') < 2 || requireFiniteNumber(chart.maximum, 'Spectrum maximum') <= 0) throw new TypeError('Invalid spectrum sampling profile.');
  for (const key of ['maximumRoundingScale', 'xScale']) if (chart[key] !== undefined && requireFiniteNumber(chart[key], key) <= 0) throw new TypeError(`Spectrum ${key} must be positive.`);
  for (const key of ['minimumX', 'maximumX', 'countValue']) if (chart[key] !== undefined) requireFiniteNumber(chart[key], key);
  for (const key of ['requiredHeader', 'xField', 'yField', 'countField']) if (chart[key] !== undefined) requireString(chart[key], key);
  if (chart.format === 'json-columns') {
    for (const key of ['xField', 'yField']) if (!requireString(chart[key], key)) throw new TypeError(`Spectrum ${key} is missing.`);
    if (chart.countField) requireFiniteNumber(chart.countValue, 'Spectrum coverage count');
  }
  if (chart.metadataFields !== undefined) for (const [key, path] of Object.entries(requireRecord(chart.metadataFields, 'Spectrum metadata fields'))) requireString(path, key);
  return chart as unknown as SpectrumRecipe;
}

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Source sampling shared by the full and compact prepared charts. */
export async function readSpectrumData(sourceDirectory: string, input: unknown) {
  const chart = parseSpectrumRecipe(input);
  if (chart.source.startsWith('/') || chart.source.includes('\\') || chart.source.split('/').includes('..')) throw new TypeError('Unsafe spectrum source path.');
  const text = await readFile(resolve(sourceDirectory, chart.source), 'utf8');
  const metadata = { ...chart.metadata };
  const field = (value: unknown, path: string | undefined): unknown => {
    if (path === undefined) throw new TypeError('Spectrum source field is missing.');
    return path.split('.').reduce<unknown>((entry, key) => isRecord(entry) ? entry[key] : isArray(entry) && /^\d+$/.test(key) ? entry[Number(key)] : undefined, value);
  };
  const numbers = (value: unknown): number[] => {
    if (!isArray(value) || !value.every((item): item is number => typeof item === 'number' && Number.isFinite(item))) throw new TypeError('Spectrum must contain finite samples.');
    return value;
  };
  let points: SpectrumPoint[];
  if (chart.format === 'json-columns') {
    const source: unknown = JSON.parse(text);
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
