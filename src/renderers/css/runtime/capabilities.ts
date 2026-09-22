import type { ObjectRuntimeCapabilities } from './object-runtime-types.js';
import { mountSurfaceFeatureLabels } from '../labels/surface-feature-labels.js';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid prepared ${label}.`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

/** The optional runtime capabilities a prepared object may declare: a place catalogue to search and fly to, and nomenclature labels. */
export const preparedObjectCapabilities: ObjectRuntimeCapabilities = Object.freeze<ObjectRuntimeCapabilities>({
  createDestinations({ plan: input, ready, lifetime, selectLens, navigate, reset }) {
    const plan = object(input, 'destinations'), catalog = object(plan.catalog, 'destination catalog');
    const statuses = object(plan.statuses, 'destination statuses');
    if (typeof catalog.url !== 'string' || !catalog.url.startsWith('/scenes/') ||
        typeof catalog.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(catalog.sha256) ||
        !integer(catalog.bytes, 1) || !integer(catalog.count, 1) ||
        typeof plan.defaultLens !== 'string' || typeof statuses.detail !== 'string' || typeof statuses.overview !== 'string') {
      throw new TypeError('Invalid prepared destination plan.');
    }
    // The catalogue itself never reaches the page: the site's search function searches it and returns one place's record
    // to select (Earth's is 14.8 MB). The plan keeps its pin, which that function verifies.
    const defaultLens = plan.defaultLens;
    const assertLive = () => { if (lifetime.disposed) throw new Error('Object was unmounted.'); };
    return Object.freeze({
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
