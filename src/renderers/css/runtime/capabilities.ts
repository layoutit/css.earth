import type { ObjectRuntimeCapabilities } from './object-runtime-types.js';
import { mountSurfaceFeatureLabels } from '../labels/surface-feature-labels.js';
import { resolvePreparedAssetUrl } from '../rendering/prepared-asset-origin.js';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

/** The optional runtime capabilities a prepared object may declare: a place catalogue to search and fly to, and nomenclature labels. */
export const preparedObjectCapabilities: ObjectRuntimeCapabilities = Object.freeze<ObjectRuntimeCapabilities>({
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
    // tracked prepared data); only the fetch address is resolved.
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
