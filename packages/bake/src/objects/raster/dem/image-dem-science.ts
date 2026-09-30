import type { SourceMesh } from '../../geometry/index.ts';
import {parseDemScience} from '../source-records.ts';
import {shape,number} from '@cssearth/core';
import { resolve } from 'node:path';
import { loadImageDem } from './image-dem.ts';

export function validateImageDemScience(value: unknown) {
  const dataset=parseDemScience(value);
  const comparison = dataset.comparison;
  if (!['height', 'difference'].includes(dataset.quantity) || dataset.relief ||
      (dataset.quantity === 'height' && comparison !== undefined) ||
      (dataset.quantity === 'difference' && (!comparison || typeof comparison.path !== 'string' ||
        !comparison.path || comparison.path.startsWith('/') || comparison.path.includes('\\') || comparison.path.split('/').includes('..') ||
        !comparison.grid || !Number.isFinite(comparison.heightOffsetMeters)))) {
    throw new TypeError('Image DEM science must specify its datum and any registered comparison.');
  }
  return dataset;
}

export async function loadImageDemScience(root: string, value: unknown, mesh?: SourceMesh | null) {
  const dataset=validateImageDemScience(value);
  if (!mesh || !("heightAt" in mesh) || !("imageGrid" in mesh) || typeof mesh.heightAt!=="function" || !['height', 'difference'].includes(dataset.quantity) || dataset.relief ||
      !dataset.surfaceSampling || !Number.isFinite(dataset.surfaceSampling.maximumDistanceMeters) || dataset.surfaceSampling.maximumDistanceMeters <= 0) {
    throw new TypeError('Image DEM science requires Cartesian heights and bounded source transfer.');
  }
  const grid=shape({zOffsetMeters:number})(mesh.imageGrid);
  if(dataset.quantity==='difference'&&!dataset.comparison)throw new Error("Missing image DEM comparison");
  const comparison = dataset.quantity === 'difference' ? await loadImageDem(resolve(root, dataset.comparison!.path), dataset.comparison!.grid) : null;
  const rawValue = (point: readonly number[]) => {
    // Keep the source height datum independently of the presentation origin.
    const height = point[2] - grid.zOffsetMeters;
    if (!comparison) return height;
    const other = comparison.heightAt(point[0], point[1]);
    return other === null ? null : height - (other + dataset.comparison!.heightOffsetMeters);
  };
  const valueAt = (point: readonly number[]) => {
    const value = rawValue(point);
    return value === null ? null : value * (dataset.valueTransform?.scale ?? 1) + (dataset.valueTransform?.offset ?? 0);
  };
  return {
    sample(longitude: number, latitude: number) {
      const hit = mesh.hit(longitude, latitude, true);
      if (!hit) return null;
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
      return valueAt([hit.radius * Math.cos(lat) * Math.cos(lon), hit.radius * Math.cos(lat) * Math.sin(lon), hit.radius * Math.sin(lat)]);
    },
    samplePoint(point: readonly number[]) {
      const hit = mesh.closestPoint(point, dataset.surfaceSampling!.maximumDistanceMeters);
      if (!hit) return null;
      const value = valueAt(hit.point);
      return value === null ? null : { ...hit, value };
    },
    report: { sourceFormat: 'image-plane-dem', quantity: dataset.quantity, units: dataset.units,
      registration: comparison ? 'USGS minus DLR height after the documented image-plane registration, restricted to shared source triangles.'
        : 'Barycentric height of the released source surface above its arbitrary image plane; not altitude above gravity or a sphere.',
      ...(comparison ? { comparison: dataset.comparison } : {}),
      validity: 'Finite released samples, including zero and negative heights. Missing grid posts remain gaps.' },
  };
}
