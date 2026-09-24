import type { ObjectEntry } from './object-schema.mts';
import { isRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireSceneObject } from './objects.mts';
import { objectClassificationLabel } from './search-objects.mts';
import { parseSpectrumRecipe, readSpectrumData } from '../tools/objects/content/spectrum-data.mts';
import { renderCompactSpectrum } from '../tools/objects/content/compact-spectrum.mts';

const root = resolve(import.meta.dirname, '..');
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const earthRadiusM = requireSceneObject('earth').worldFrame!.bodyRadiusM;

export function overviewMeasurements(object: Pick<ObjectEntry, 'worldFrame' | 'distance'>, referenceRadiusM = earthRadiusM) {
  const radius = object.worldFrame?.bodyRadiusM ?? Number.NaN;
  const ratio = radius / referenceRadiusM;
  return {
    radiusEarth: Number.isFinite(ratio) && ratio > 0 ?
      (ratio < .01 ? ratio.toPrecision(2) : number.format(ratio)) : null,
    distanceAu: number.format(object.distance.value),
  };
}

// Runs in Astro's preparation/build process; the browser receives only HTML and an image.
export async function prepareBodyOverview(objectId: string) {
  const object = requireSceneObject(objectId);
  const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
  const presentationPath = resolve(sourceDirectory, 'presentation/overview.json');
  const presentation: unknown = existsSync(presentationPath) ? JSON.parse(await readFile(presentationPath, 'utf8')) : {};
  if (!isRecord(presentation) || (presentation.classificationLabel !== undefined && typeof presentation.classificationLabel !== 'string')) throw new TypeError('Invalid object overview presentation.');
  const image = [`/overview/${objectId}.webp`, `/social/${objectId}.jpg`]
    .find(url => existsSync(resolve(root, 'public', url.slice(1))));
  let spectrum = null;
  const chartPath = resolve(sourceDirectory, 'content/charts.json');
  if (existsSync(chartPath)) {
    const recipe: unknown = JSON.parse(await readFile(chartPath, 'utf8'));
    if (!isRecord(recipe) || !Array.isArray(recipe.charts)) throw new TypeError('Overview charts require prepared recipes.');
    const selected: unknown = recipe.charts.find((chart: unknown) => isRecord(chart) && chart.kind === 'spectrum');
    if (selected) {
      const chart = parseSpectrumRecipe(selected);
      const data = await readSpectrumData(sourceDirectory, chart);
      const svg = renderCompactSpectrum({ ...chart, ...data });
      spectrum = {
        title: /model/i.test(chart.title) ? 'Modeled reflectance' : 'Reflectance',
        alt: chart.description,
        src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      };
    }
  }
  return { image, spectrum, classification: presentation.classificationLabel ?? objectClassificationLabel(object.classification), ...overviewMeasurements(object) };
}
