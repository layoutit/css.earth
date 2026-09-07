import { createPreparedDestinations } from './prepared-destinations.js';
import type { ObjectRuntimeCapabilities } from '../runtime/object-runtime-types.js';
import type { PreparedPagePlan } from './types.js';
import { mountPreparedMapPages } from './city-pages.js';
import { isPreparedAssetPath, normalizeCityAssetOrigin } from './city-asset-url.js';

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
export function parsePreparedPagePlan(input: unknown, { lensIds, geographic = false }: { lensIds?: readonly string[]; geographic?: boolean } = {}): PreparedPagePlan {
  const plan = object(input, 'page plan');
  if (plan.schema !== 'cssearth-prepared-map-pages@1' || !isPreparedAssetPath(plan.assetPath) ||
      normalizeCityAssetOrigin(plan.assetOrigin) !== plan.assetOrigin || (geographic ? plan.dataset !== null : typeof plan.dataset !== 'string') ||
      !integer(plan.poolSize, 1, 512) || !integer(plan.decodedPageBytes, 1) ||
      !integer(plan.maximumDecodedBytes, Number(plan.decodedPageBytes) * 2) ||
      !integer(plan.maximumConcurrentLoads, 1, 512) || typeof plan.minimumZoom !== 'number' ||
      !Number.isFinite(plan.minimumZoom) || typeof plan.rasterScale !== 'number' || !Number.isFinite(plan.rasterScale) || plan.rasterScale < 1 ||
      !Array.isArray(plan.roots) || (geographic ? plan.roots.length !== 0 : !plan.roots.length) ||
      (plan.pageTemplate !== undefined && plan.pageTemplate !== 'clipped-projective')) {
    throw new TypeError('Invalid prepared page plan.');
  }
  const initial = object(plan.initialLayer, 'page initial layer');
  if(plan.opaqueDiscs!==undefined){
    if(!Array.isArray(plan.opaqueDiscs)||plan.opaqueDiscs.length>16)throw new TypeError('Invalid prepared opaque discs.');
    for(const value of plan.opaqueDiscs){
      const disc=object(value,'opaque disc');
      if(![disc.center,disc.normal].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||
        typeof disc.radius!=='number'||!Number.isFinite(disc.radius)||disc.radius<=0||
        Math.abs(Math.hypot(...(disc.normal as number[]))-1)>1e-8)throw new TypeError('Invalid prepared opaque disc.');
    }
  }
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
    return mountPreparedMapPages({ ...options, plan: parsePreparedPagePlan(options.plan, { lensIds, geographic: options.geographic }),
      carrier, system, className, textureClassName, lensIds });
  },
  createDestinations: createPreparedDestinations,
});
