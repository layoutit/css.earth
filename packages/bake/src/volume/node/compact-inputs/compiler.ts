/** Accepted analytic emission and component colors: no source images, fitting, or baked pixels. */
import { readCompactCompiler, readCompilerBakeResult, type CompilerBakeResult } from '@cssearth/objects';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { bakeCompiler, type CompilerBakeProgress, type CompilerBakeBackend, type CompiledVolumeArtifact } from '../compiler/bake.ts';
import { createPhotometricEmission } from '../../fields/photometric-emission.ts';

import { pinned, type CompilerPin } from './io.ts';

export interface CompactCompilerBackend extends CompilerBakeBackend {
  readVolume(value: unknown): CompiledVolumeArtifact;
}

export async function replayCompactCompiler(root: string, pin: CompilerPin, outputDirectory: string, backend: CompactCompilerBackend,
  progress?: (progress: CompilerBakeProgress) => void) {
  const input = readCompactCompiler(JSON.parse(gunzipSync(await pinned(root, pin), { maxOutputLength: 16 * 1024 * 1024 }).toString()));
  const field = createPhotometricEmission(input.field), old = input.scene, origin = old.coordinates.localOriginArcsec;
  const preparedPhysical = old.frame.referenceFrame === 'lab-sky-west-north-toward';
  const scene = await bakeCompiler({ root, outputDirectory, id: old.volumeId ?? old.id, fieldIdentity: old.fieldIdentity,
    sampling: old.sampling, preparedPhysical, historicalReplay: old.sampling.renderBudget === undefined,
    boundsArcsec: old.boundsArcsec, skyBoundsArcsec: old.skyBoundsArcsec, minimumFeatureScaleArcsec: input.minimumFeatureScaleArcsec,
    sampleEmission: field.sampleEmission, datasets: input.materials.map((material, index) => ({ id: material.sourceId,
      label: input.sources[index]!.label, sampleMaterial: field.createMaterialSampler(material.components, material.envelopeColors) })),
    stars: old.stars.map(star => ({ ...star, positionArcsec: [star.positionUnits[0] + origin[0], star.positionUnits[1] + origin[1],
      (preparedPhysical ? -star.positionUnits[2] : star.positionUnits[2]) + origin[2]] })), progress }, backend);
  assert.deepEqual(scene.sampling, old.sampling, 'Compact replay changed sampling.');
  // Output locations change with every bake; the sprite content may not.
  const spriteContent = (sprites: typeof scene.starSprites) => sprites && { ...sprites, atlas: undefined, profile: undefined };
  assert.deepEqual(spriteContent(scene.starSprites), spriteContent(old.starSprites), 'Compact replay changed stellar sprites.');
  const banks = [{ id: 'neutral', volume: scene.neutral }, ...scene.datasets];
  for (const [index, bank] of banks.entries()) {
    const volume = backend.readVolume(JSON.parse((await pinned(root, bank.volume)).toString()));
    assert.deepEqual(volume.resources, input.expected[index]!.resources, `Compact replay changed ${bank.id} texture sizes or dimensions.`);
    for (const resource of volume.resources) {
      const bytes = await pinned(root, { path: `${dirname(bank.volume.path)}/${resource.path}` });
      assert.equal(bytes.length, resource.bytes);
    }
  }
  // Preserve accepted stellar positions exactly; inverse origin arithmetic need not round-trip float bits.
  const retained: CompilerBakeResult = { ...scene, id: old.id, ...(old.volumeId ? { volumeId: old.volumeId } : {}), stars: old.stars };
  readCompilerBakeResult(retained);
  return { id: old.id, scene: retained, sources: input.sources, objectId: input.objectId };
}
