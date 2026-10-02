import { isRecord } from '@cssearth/core';
import type { EnvelopeColors } from './photometric-emission.js';
export const COMPONENT_MATERIAL_SCHEMA = 'cssearth-component-bound-material@1';
export interface ComponentMaterialColor {
  id: string; rgb: [number, number, number]; covered: boolean;
  observedKernelFraction?: number; coloredKernelFraction?: number;
}
export interface ComponentMaterialReceipt {
  schema: typeof COMPONENT_MATERIAL_SCHEMA; sourceId: string; fieldIdentity: string;
  components: ComponentMaterialColor[]; envelopeColors?: EnvelopeColors;
  method?: string; quadrature?: { rule: string; samplesPerProjectedAxis: number; supportSigma: number[] }; assumptions?: string[];
}
/** Historical receipts may omit audit metadata; delivery requires the retained component colors. */
export function readComponentMaterialReceipt(value: unknown, sourceId: string, fieldIdentity: string): ComponentMaterialReceipt {
  if (!isRecord(value) || value.schema !== COMPONENT_MATERIAL_SCHEMA || value.sourceId !== sourceId || value.fieldIdentity !== fieldIdentity || !Array.isArray(value.components))
    throw new TypeError(`Missing accepted component colors for ${sourceId}.`);
  const components = value.components.map((color: unknown): ComponentMaterialColor => {
    if (!isRecord(color)) throw new TypeError('Invalid retained component.');
    if (typeof color.id !== 'string' || !Array.isArray(color.rgb) || color.rgb.length !== 3 ||
        !color.rgb.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255) || typeof color.covered !== 'boolean')
      throw new TypeError('Compact material component differs.');
    return { id: color.id, rgb: [color.rgb[0], color.rgb[1], color.rgb[2]], covered: color.covered };
  });
  // Envelope colors are validated against the retained field dimensions by readCompactCompiler.
  const colors = value.envelopeColors;
  let envelopeColors: EnvelopeColors | undefined;
  if (colors !== undefined) {
    if (!isRecord(colors) || typeof colors.width !== 'number' || !Number.isInteger(colors.width) || colors.width < 2 ||
        typeof colors.height !== 'number' || !Number.isInteger(colors.height) || colors.height < 2 || !Array.isArray(colors.rgb) ||
        colors.rgb.length !== colors.width * colors.height * 3 || !colors.rgb.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255))
      throw new TypeError('Missing or invalid retained envelope colors.');
    envelopeColors = { width: colors.width, height: colors.height, rgb: colors.rgb };
  }
  return { schema: COMPONENT_MATERIAL_SCHEMA, sourceId, fieldIdentity, components,
    ...(envelopeColors === undefined ? {} : { envelopeColors }) };
}
