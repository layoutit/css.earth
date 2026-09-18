import type { ObjectRuntimeCapabilities } from '../runtime/object-runtime-types.js';
import type { PreparedPagePlan } from './types.js';
import { mountPreparedMapPages } from './city-pages.js';
import { isPreparedAssetPath, normalizeCityAssetOrigin } from './city-asset-url.js';
import { mountSurfaceFeatureLabels } from '../labels/surface-feature-labels.js';
import { resolvePreparedAssetUrl } from '../rendering/prepared-asset-origin.js';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function finiteMatrix(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const components = value.split(',').map(component => component.trim());
  return components.length === 16 && components.every(component =>
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(component) && Number.isFinite(Number(component)));
}
function identifiedLenses(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(value).size === value.length;
}

/** Validate the optional transport capability before allocating retained leaves. */
export function parsePreparedPagePlan(input: unknown, { lensIds }: { lensIds?: readonly string[] } = {}): PreparedPagePlan {
  const plan = object(input, 'page plan');
  if (plan.schema !== 'cssearth-prepared-map-pages@1' || !isPreparedAssetPath(plan.assetPath) ||
      normalizeCityAssetOrigin(plan.assetOrigin) !== plan.assetOrigin || typeof plan.dataset !== 'string' ||
      !integer(plan.poolSize, 1, 512) || !integer(plan.decodedPageBytes, 1) ||
      !integer(plan.maximumDecodedBytes, Number(plan.decodedPageBytes) * 2) ||
      !integer(plan.maximumConcurrentLoads, 1, 512) || typeof plan.minimumZoom !== 'number' ||
      !Number.isFinite(plan.minimumZoom) || typeof plan.rasterScale !== 'number' || !Number.isFinite(plan.rasterScale) || plan.rasterScale < 1 ||
      !Array.isArray(plan.roots) || !plan.roots.length ||
      (plan.pageTemplate !== undefined && plan.pageTemplate !== 'clipped-projective')) {
    throw new TypeError('Invalid prepared page plan.');
  }
  const initial = object(plan.initialLayer, 'page initial layer');
  if (!finiteMatrix(initial.frameMatrix) || !finiteMatrix(initial.textureMatrix)) throw new TypeError('Invalid prepared page matrices.');
  if (lensIds !== undefined && !identifiedLenses(lensIds)) throw new TypeError('Invalid prepared page binding lenses.');
  if (plan.lensIds !== undefined && (!identifiedLenses(plan.lensIds) || lensIds !== undefined &&
      (plan.lensIds.length !== lensIds.length || plan.lensIds.some(id => !lensIds.includes(id))))) {
    throw new TypeError('Invalid prepared page lenses: plan and binding must agree.');
  }
  const limits = object(plan.index, 'page index limits');
  for (const key of ['maximumDirectories', 'maximumBytes', 'maximumConcurrentLoads', 'maximumDirectoryBytes']) {
    if (!integer(limits[key], 1)) throw new TypeError(`Invalid prepared page index ${key}.`);
  }
  for (const root of plan.roots) {
    const page = object(root, 'page root');
    if (typeof page.key !== 'string' || (page.stub !== true && !Array.isArray(page.children)) ||
        !Array.isArray(page.corners) || !page.corners.length ||
        page.corners.some(corner => !Array.isArray(corner) || corner.length !== 3 || !corner.every(Number.isFinite)) ||
        !Array.isArray(page.normal) || page.normal.length !== 3 || !page.normal.every(Number.isFinite)) {
      throw new TypeError('Invalid prepared page root.');
    }
  }
  return plan as unknown as PreparedPagePlan;
}

export const preparedObjectCapabilities: ObjectRuntimeCapabilities = Object.freeze<ObjectRuntimeCapabilities>({
  mountPages(options) {
    const { carrier, system, className, textureClassName, lensIds } = options;
    if (typeof className !== 'string' || typeof textureClassName !== 'string' ||
        !identifiedLenses(lensIds)) throw new TypeError('Invalid prepared page binding.');
    return mountPreparedMapPages({ ...options, plan: parsePreparedPagePlan(options.plan, { lensIds }),
      carrier, system, className, textureClassName, lensIds });
  },
  createDestinations({ plan: input, ready, lifetime, selectLens, navigate, reset, assetOrigin }) {
    const plan = object(input, 'destinations'), catalog = object(plan.catalog, 'destination catalog');
    const statuses = object(plan.statuses, 'destination statuses');
    if (typeof catalog.url !== 'string' || !catalog.url.startsWith('/scenes/') ||
        typeof catalog.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(catalog.sha256) ||
        !integer(catalog.bytes, 1) || !integer(catalog.count, 1) ||
        typeof plan.defaultLens !== 'string' || typeof statuses.detail !== 'string' || typeof statuses.overview !== 'string') {
      throw new TypeError('Invalid prepared destination plan.');
    }
    // The address stays `/scenes/…` in the plan itself (so this check keeps validating the
    // tracked prepared data); only the fetch address is resolved, mirroring city-index.ts.
    const url = resolvePreparedAssetUrl(catalog.url, assetOrigin, catalog.sha256), defaultLens = plan.defaultLens;
    const controller = new AbortController();
    lifetime.onDispose(() => controller.abort());
    const assertLive = () => { if (lifetime.disposed) throw new Error('Object was unmounted.'); };
    return Object.freeze({
      async load(signal?: AbortSignal) {
        assertLive();
        const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal });
        if (!response.ok) throw new Error('City catalogue request failed.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== catalog.bytes) throw new Error('City catalogue size drifted.');
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
        assertLive();
        if (digest !== catalog.sha256) throw new Error('City catalogue identity drifted.');
        const data = object(JSON.parse(new TextDecoder().decode(bytes)), 'destination catalog');
        if (data.schema !== 'cssearth-prepared-destinations@1' || !Array.isArray(data.places) || data.places.length !== catalog.count) throw new Error('City catalogue is incompatible.');
        return data;
      },
      async select(input: unknown) {
        const place = object(input, 'destination');
        await ready; assertLive();
        if (!await selectLens(defaultLens)) throw new Error('Destination selection was superseded.');
        assertLive();
        const camera = object(place.camera, 'destination camera');
        for (const key of ['controlPitch', 'controlYaw', 'zoom']) {
          if (typeof camera[key] !== 'number' || !Number.isFinite(camera[key])) throw new TypeError(`Invalid prepared destination camera ${key}.`);
        }
        return { status: place.coverage === 'detail' ? statuses.detail : statuses.overview,
          arrival: navigate({ ...camera, controlPitch: camera.controlPitch as number,
            controlYaw: camera.controlYaw as number, zoom: camera.zoom as number }) };
      },
      reset() { if (!lifetime.disposed) return reset(); },
    });
  },
  mountSurfaceFeatures(options) { return mountSurfaceFeatureLabels(options); },
});
