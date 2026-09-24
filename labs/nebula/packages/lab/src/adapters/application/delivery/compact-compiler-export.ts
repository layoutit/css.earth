/** Explicitly promote an already inspected compiler result to small, source-backed bake inputs. */
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { hash, localPath, pinned } from '../../../server/workflows/density/io.ts';
import { writeAtomic } from '@cssearth/volume-bake/compact-inputs/io';
import { readCompactCompiler } from './compact-compiler.ts';
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export async function exportCompactCompiler(root: string, objectId: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(objectId)) throw new TypeError('Invalid object identity.');
  const receipt: unknown = JSON.parse(await readFile(localPath(root, `src/objects/${objectId}/prepared/delivery.json`), 'utf8'));
  if (!record(receipt) || typeof receipt.sourceResult !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.sourceResult)) throw new TypeError('Missing current app result.');
  const resultPath = `.local/nebula-lab/compiler/${receipt.sourceResult}/result.json`, resultBytes = await readFile(localPath(root, resultPath));
  const result = readCompilerResult(JSON.parse(resultBytes.toString()));
  const modelBytes = await pinned(root, result.model), methodBytes = await pinned(root, result.method);
  const method: unknown = JSON.parse(methodBytes.toString());
  if (!record(method) || !Array.isArray(method.materials)) throw new TypeError('Historical projected-image material is not a compact component material.');
  const receipts: unknown[] = [...method.materials];
  if (record(method.opticalComposite)) receipts.push(method.opticalComposite.material);
  const materials = result.scene.lenses.map(lens => {
    const material = receipts.find(m => record(m) && m.sourceId === lens.id);
    if (!record(material) || material.schema !== 'cssearth-component-bound-material@1' || material.fieldIdentity !== result.scene.fieldIdentity || !Array.isArray(material.components))
      throw new TypeError(`Missing accepted component colors for ${lens.id}.`);
    return { sourceId: lens.id, ...(material.envelopeColors === undefined ? {} : { envelopeColors: material.envelopeColors }), components: material.components.map((color: unknown) => {
      if (!record(color)) throw new TypeError('Invalid retained component.');
      return { id: color.id, rgb: color.rgb, covered: color.covered };
    }) };
  });
  const banks = [{ id: 'neutral', volume: result.scene.neutral }, ...result.scene.lenses];
  let minimumFeatureScaleArcsec: unknown;
  const expected = [];
  for (const bank of banks) {
    const volume = validatePreparedCssVolume(JSON.parse((await pinned(root, bank.volume)).toString()));
    if (bank.id === 'neutral' && record(volume.provenance)) minimumFeatureScaleArcsec = volume.provenance.minimumFeatureScaleArcsec;
    expected.push({ id: bank.id, resources: volume.resources });
  }
  const input = { schema: 'cssearth-compact-compiler@1', objectId,
    provenance: { resultPath, resultSha256: hash(resultBytes), modelSha256: hash(modelBytes), methodSha256: hash(methodBytes),
      interpretation: 'Accepted fitted emission components, any retained photometric envelope with coarse source chromaticity, per-component colors, stars and sampling. Derived field inputs, not measured volumetric gas density. Full source acquisition remains available in the research recipes.' },
    field: JSON.parse(modelBytes.toString()), scene: result.scene, materials,
    sources: result.scene.lenses.map(lens => { const source = result.sources.find(source => source.id === lens.id)!;
      return { id: lens.id, label: lens.label, credit: source.credit, page: source.page }; }),
    minimumFeatureScaleArcsec, expected };
  readCompactCompiler(input);
  const raw = Buffer.from(JSON.stringify(input)), bytes = gzipSync(raw, { level: 9 });
  const path = `src/objects/${objectId}/source/bake-inputs.json.gz`;
  await writeAtomic(localPath(root, path), bytes);
  return { path, sha256: hash(bytes), bytes: bytes.length, uncompressedBytes: raw.length };
}
