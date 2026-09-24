/** Prepared grayscale diagnostics; runtime selects verified images, never computes their pixels. */
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import sharp from 'sharp';
import { containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import { compareShapeSignal, comparisonPixels, type NeutralProjection } from '@cssearth/nebula-reconstruction/evidence/shape-comparison';
import { comparisonChannels, comparisonGains } from '../../../features/shape-cloud/comparison-result.ts';
import type { ShapeCloudComparison, ShapeCloudComparisonLevel, ShapeCloudPin } from '../../../features/shape-cloud/types.ts';

export async function writeShapeComparison(input: {
  root: string; directory: string; rgb: Uint8Array; width: number; height: number;
  projection?: NeutralProjection; signal?: AbortSignal;
}): Promise<ShapeCloudComparison> {
  input.signal?.throwIfAborted();
  const data = compareShapeSignal(input.rgb, input.width, input.height, input.projection);
  const directory = containedPath(input.root, `${input.directory}/comparison`);
  await mkdir(directory, { recursive: true });
  const levels: ShapeCloudComparisonLevel[] = [];
  for (const gain of comparisonGains) {
    const pins = new Map<string, ShapeCloudPin>();
    await Promise.all(comparisonChannels.map(async channel => {
      input.signal?.throwIfAborted();
      const edge = channel === 'sourceEdges' || channel === 'modelEdges';
      const pixels = comparisonPixels(data[channel], edge ? data.edgeWhiteLevel : data.whiteLevel, gain, channel === 'difference');
      const bytes = await sharp(pixels, { raw: { width: input.width, height: input.height, channels: 1 } })
        .png({ compressionLevel: 3 }).toBuffer();
      input.signal?.throwIfAborted();
      const path = containedPath(directory, `${channel}-${gain}.png`);
      await writeFile(path, bytes); pins.set(channel, { path: relative(input.root, path), sha256: sha256(bytes) });
    }));
    levels.push({ gain, source: pins.get('source')!, model: pins.get('model')!, sourceEdges: pins.get('sourceEdges')!,
      modelEdges: pins.get('modelEdges')!, difference: pins.get('difference')! });
  }
  input.signal?.throwIfAborted();
  await writeFile(containedPath(directory, 'method.json'), JSON.stringify({
    schema: 'cssearth-shape-cloud-comparison-method@1', brightnessScale: data.brightnessScale, metrics: data.metrics,
    coordinates: 'Full original working-image pixel grid; complete baked neutral Z projection mapped using its physical bounds. Empty outside support, no recentering or crop fit.',
    signal: 'Relative display luminance: (0.2126 R + 0.7152 G + 0.0722 B) / 255. No recovered calibrated flux or gas density.',
    amplitude: 'One nonnegative least-squares scalar matches model brightness to source across the full frame. It changes diagnostics only, not the baked volume. No per-pixel normalization.',
    edges: 'Gradient magnitude after equal Gaussian smoothing on both full grids; sigma=max(1,width/384) source pixels. These are projected transitions, not depth or relief.',
    display: { whiteLevel: data.whiteLevel, edgeWhiteLevel: data.edgeWhiteLevel, gains: comparisonGains,
      rule: 'Source-derived 99.5th-percentile white points, shared by source and model. Gain only changes display; numerical metrics precede display clipping.',
      difference: 'Signed source minus amplitude-matched model. White=missing, black=excess, midgray128=match.' },
    interpretation: 'A grayscale fitting diagnostic, not a unique 3D reconstruction. Background and residual-star signal stay visible and must not all be promoted to nebular components.',
  }, null, 2) + '\n');
  return { schema: 'cssearth-shape-cloud-comparison@1', width: input.width, height: input.height,
    brightnessScale: data.brightnessScale, metrics: data.metrics, levels };
}
