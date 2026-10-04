import { requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
/** Decode source samples for compact spectrum charts independently of the other chart kinds and @cssearth/bake. */
export interface SpectrumRecipe {id:string;title:string;description:string;output:string;metadata:Record<string,unknown>;kind:'spectrum';source:string;format:'json-columns'|'numeric-lines';pointCount:number;maximum:number;maximumRoundingScale?:number;requiredHeader?:string;xField?:string;yField?:string;countField?:string;countValue?:number;xScale?:number;minimumX?:number;maximumX?:number;metadataFields?:Record<string,string>;}

/** Decode the exact profile used by both prepared spectrum presentations. */
export function parseSpectrumRecipe(value: unknown, admission: 'source' | 'chart-assets' = 'source'): SpectrumRecipe {
  const chart = requireRecord(value, 'Spectrum recipe');
  if (admission === 'chart-assets') {
    if(typeof chart.source !== 'string' || !chart.source.trim()) throw new TypeError('source must be text.');if(!['json-columns','numeric-lines'].includes(String(chart.format))||typeof chart.pointCount!=='number'||!Number.isSafeInteger(chart.pointCount)||chart.pointCount<2||typeof chart.maximum!=='number'||!Number.isFinite(chart.maximum)||chart.maximum<=0||(chart.maximumRoundingScale!==undefined&&(typeof chart.maximumRoundingScale!=='number'||!Number.isFinite(chart.maximumRoundingScale)||chart.maximumRoundingScale<=0)))throw new TypeError('Invalid spectrum sampling profile.');
    return chart as unknown as SpectrumRecipe;
  }
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

