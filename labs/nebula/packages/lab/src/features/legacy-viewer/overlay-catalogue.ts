import { defaultOverlayPlacement, updateOverlayPlacement, type OverlayPlacement, type DensityVolumeFrame } from '@cssearth/bake/volume';
import type { OverlayVariant } from './overlay-variants';
export interface DensityOverlay {
  id: string; label: string; sha256: string; texturePath: string; widthPx: number; heightPx: number;
  variants?: OverlayVariant[]; removalResultId?: string;
  pivotCssPx: [number, number, number];
  initialPlacement?: OverlayPlacement; initialOpacity?: number;
  legacyPlacementBasis?: string;
  style: { width: string; height: string; transform: string; backgroundSize: string; backgroundPosition: string };
  sourcePageUrl: string; credit: string; registrationNote: string;
}
export interface DensityOverlayCatalogue { schema: 'cssearth-nebula-overlays@1'; frame: Omit<DensityVolumeFrame, 'boundsUnits'>; overlays: DensityOverlay[]; referenceDistanceUnits?: number; }

export function relativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/^(?:[a-z]+:|\/)/i.test(value) &&
    !value.split('/').includes('..') && !/[\\\u0000-\u0020?#]/.test(value);
}
function finiteVector(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(item => typeof item === 'number' && Number.isFinite(item));
}
export function parseOverlayCatalogue(value: unknown): DensityOverlayCatalogue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid density overlay catalogue.');
  const data = value as Record<string, unknown>, frame = data.frame as Record<string, unknown>;
  if (data.schema !== 'cssearth-nebula-overlays@1' || !frame || Array.isArray(frame) ||
      typeof frame.referenceFrame !== 'string' || !frame.referenceFrame || typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt) ||
      !finiteVector(frame.originM, 3) || !finiteVector(frame.localToReferenceXyzw, 4) ||
      Math.abs(Math.hypot(...(frame.localToReferenceXyzw as number[])) - 1) > 1e-9 ||
      typeof frame.metersPerUnit !== 'number' || !Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0 ||
      !Array.isArray(data.overlays)) throw new TypeError('Invalid prepared density overlay frame.');
  const ids = new Set<string>();
  const overlays = data.overlays.map(input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid density overlay.');
    const item = input as Record<string, unknown>, style = item.style as Record<string, unknown>;
    const styleKeys = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'];
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || !item.label ||
        !relativePath(item.texturePath) || !Number.isInteger(item.widthPx) || (item.widthPx as number) < 1 ||
        !Number.isInteger(item.heightPx) || (item.heightPx as number) < 1 || !style || Array.isArray(style) ||
        Object.keys(style).some(key => !styleKeys.includes(key)) || styleKeys.some(key => typeof style[key] !== 'string' || !style[key]) ||
        typeof item.sourcePageUrl !== 'string' || !/^https:\/\//.test(item.sourcePageUrl) ||
        typeof item.credit !== 'string' || !item.credit || typeof item.registrationNote !== 'string' || !item.registrationNote ||
        !finiteVector(item.pivotCssPx, 3)) {
      throw new TypeError('Invalid prepared density overlay.');
    }
    ids.add(item.id);
    const initialPlacement = item.initialPlacement === undefined ? undefined : updateOverlayPlacement(defaultOverlayPlacement(), item.initialPlacement as Partial<OverlayPlacement>);
    if (item.legacyPlacementBasis !== undefined && typeof item.legacyPlacementBasis !== 'string') throw new TypeError('Invalid legacy image placement basis.');
    if (item.initialOpacity !== undefined && (typeof item.initialOpacity !== 'number' || !Number.isFinite(item.initialOpacity) || item.initialOpacity < 0 || item.initialOpacity > 1)) throw new TypeError('Invalid initial image opacity.');
    return { id: item.id, label: item.label, sha256: item.sha256, texturePath: item.texturePath, widthPx: item.widthPx, heightPx: item.heightPx,
      pivotCssPx: item.pivotCssPx, initialPlacement, initialOpacity: item.initialOpacity, legacyPlacementBasis: item.legacyPlacementBasis,
      style: Object.fromEntries(styleKeys.map(key => [key, style[key]])) as DensityOverlay['style'],
      sourcePageUrl: item.sourcePageUrl, credit: item.credit, registrationNote: item.registrationNote };
  });
  const referenceDistanceUnits = data.referenceDistanceUnits ?? data.observerDistanceUnits;
  if (referenceDistanceUnits !== undefined && (typeof referenceDistanceUnits !== 'number' || !Number.isFinite(referenceDistanceUnits) || referenceDistanceUnits <= 0)) {
    throw new TypeError('Overlay reference distance must be positive.');
  }
  return { schema: 'cssearth-nebula-overlays@1', frame: {
    referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: frame.originM as number[],
    localToReferenceXyzw: frame.localToReferenceXyzw as number[], metersPerUnit: frame.metersPerUnit,
  }, overlays, ...(data.referenceDistanceUnits === undefined && data.observerDistanceUnits === undefined ? {} : {
    referenceDistanceUnits: data.referenceDistanceUnits ?? data.observerDistanceUnits,
  }) } as unknown as DensityOverlayCatalogue;
}
export function sameOverlayFrame(a: DensityOverlayCatalogue['frame'], b: DensityVolumeFrame): boolean {
  return a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt && a.metersPerUnit === b.metersPerUnit &&
    JSON.stringify(a.originM) === JSON.stringify(b.originM) && JSON.stringify(a.localToReferenceXyzw) === JSON.stringify(b.localToReferenceXyzw);
}
