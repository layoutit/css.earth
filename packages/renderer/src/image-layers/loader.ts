import { parseImageLayerBankDescriptor } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { PreparedCssVolume } from '../volume/types.js';

export interface PreparedImageLayerView {
  readonly axis: 'x' | 'y' | 'z';
  readonly normalUnits: readonly [number, number, number];
  readonly samplingStepUnits: number;
}
export interface PreparedCssImageLayers extends PreparedCssVolume {
  readonly bankViews: readonly PreparedImageLayerView[];
}

/** Decode an offline image model into the common prepared projective-leaf presentation. */
export function validatePreparedImageLayerBank(input: unknown): PreparedCssImageLayers {
  const data = record(input);
  if (data.schema !== 'cssearth-image-layer-bank@1' || !Array.isArray(data.banks)) throw new TypeError('Unsupported image-layer bank.');
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
  return { ...validatePreparedCssVolume({ schema: 'cssearth-css-volume@1', id: data.id, frame: data.frame,
    anchors: [], stacks, resources: data.resources, provenance: data.provenance, approximation: data.approximation }), bankViews };
}

export async function loadPreparedCssImageLayers(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssImageLayers> {
  const descriptor = parseImageLayerBankDescriptor(input);
  if (descriptor.prepared?.format !== 'cssearth-image-layer-bank@1') throw new TypeError('Image layers require a prepared bank.');
  const bytes = await transport.read(descriptor.prepared.url);
  const payload = validatePreparedImageLayerBank(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(descriptor.frame)) {
    throw new TypeError('Prepared image-layer identity/frame mismatch.');
  }
  return payload;
}
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid prepared image-layer record.');
  return input as Record<string, unknown>;
}
