import { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_IMAGE_LAYER_BANK_SCHEMA } from './volume-schemas.js';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from './image-layer-bank-types.js';

/** Decode an offline image model into the common prepared projective-leaf presentation. */
export function validatePreparedImageLayerBank(input: unknown): PreparedCssImageLayers {
  const data = record(input);
  if (data.schema !== PREPARED_IMAGE_LAYER_BANK_SCHEMA || !Array.isArray(data.banks)) throw new TypeError('Unsupported image-layer bank.');
  const bankViews: PreparedImageLayerView[] = [];
  const stacks = data.banks.map(input => {
    const bank = record(input);
    const normal = bank.normalUnits;
    if (!['x', 'y', 'z'].includes(String(bank.axis)) || !Array.isArray(normal) || normal.length !== 3 ||
        !normal.every(value => typeof value === 'number' && Number.isFinite(value)) || Math.abs(Math.hypot(...normal) - 1) > 1e-8 ||
        typeof bank.samplingStepUnits !== 'number' || !Number.isFinite(bank.samplingStepUnits) || bank.samplingStepUnits <= 0) {
      throw new TypeError('Image-layer views require prepared plane normals and sampling intervals.');
    }
    bankViews.push({ axis: bank.axis as PreparedImageLayerView['axis'],
      normalUnits: normal as [number, number, number], samplingStepUnits: bank.samplingStepUnits });
    if (!Array.isArray(bank.leaves)) throw new TypeError('Image-layer bank needs prepared leaves.');
    return { axis: bank.axis, leaves: bank.leaves.map(input => {
      const leaf = record(input);
      return { id: leaf.id, centerUnits: leaf.centerUnits, texturePath: leaf.texturePath,
        widthPx: leaf.widthPx, heightPx: leaf.heightPx, style: leaf.style };
    }) };
  });
  if (bankViews.length === 3) {
    const [a, b, c] = bankViews.map(view => view.normalUnits);
    const determinant = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    if (Math.abs(determinant) < 1e-8) throw new TypeError('Image-layer views must cover three independent directions.');
  }
  return { ...validatePreparedCssVolume({ schema: PREPARED_CSS_VOLUME_SCHEMA, id: data.id, frame: data.frame,
    anchors: [], stacks, resources: data.resources, provenance: data.provenance, approximation: data.approximation }), bankViews };
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid prepared image-layer record.');
  return input as Record<string, unknown>;
}
