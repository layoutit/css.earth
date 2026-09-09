import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireObject } from './objects.mjs';
import { objectClassificationLabel } from './planet-search-objects.mjs';
import { readSpectrumData } from '../tools/objects/content/spectrum-data.mjs';
import { renderCompactSpectrum } from '../tools/objects/content/compact-spectrum.mjs';

const root = resolve(import.meta.dirname, '..');
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const earthRadiusM = requireObject('earth').worldFrame.bodyRadiusM;

export function overviewMeasurements(object, referenceRadiusM = earthRadiusM) {
  const radius = object.worldFrame?.bodyRadiusM;
  const ratio = radius / referenceRadiusM;
  return {
    radiusEarth: Number.isFinite(ratio) && ratio > 0 ?
      (ratio < .01 ? ratio.toPrecision(2) : number.format(ratio)) : null,
    distanceAu: Number.isFinite(object.distanceAu) ? number.format(object.distanceAu) : null,
  };
}

// Runs in Astro's preparation/build process; the browser receives only HTML and an image.
export async function prepareBodyOverview(objectId) {
  const object = requireObject(objectId);
  const sourceDirectory = resolve(root, 'src/planets', objectId, 'source');
  const presentationPath = resolve(sourceDirectory, 'presentation/overview.json');
  const presentation = existsSync(presentationPath) ? JSON.parse(await readFile(presentationPath, 'utf8')) : {};
  const image = [`/overview/${objectId}.webp`, `/social/${objectId}.jpg`]
    .find(url => existsSync(resolve(root, 'public', url.slice(1))));
  let spectrum = null;
  const chartPath = resolve(sourceDirectory, 'content/charts.json');
  if (existsSync(chartPath)) {
    const recipe = JSON.parse(await readFile(chartPath, 'utf8'));
    const chart = recipe.charts.find(chart => chart.kind === 'spectrum');
    if (chart) {
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
