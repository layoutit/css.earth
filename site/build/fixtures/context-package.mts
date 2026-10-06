import { VOLUME_SOURCE_MANIFEST_SCHEMA, VOLUME_PRESENTATION_SOURCE_SCHEMA, OBJECT_SCHEMA, PREPARED_CSS_VOLUME_SCHEMA, PREPARED_VOLUME_DATASETS_SCHEMA, PREPARED_VOLUME_DATASET_INDEX_SCHEMA, type PreparedVolumeDatasets } from '@cssearth/objects';
import { volumeDatasetBankFiles } from '@cssearth/objects/node';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Small structural fixture: these bytes test installation, not image decoding. Only inventory.json carries the R2
 * content address of each published file; the prepared records name files by path and size. */
export async function writeContextPackage(root: string, id: string) {
  const address = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const image = Buffer.from('fixture texture bytes');
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const bank = { schema: PREPARED_VOLUME_DATASETS_SCHEMA, id, defaultDataset: 'optical', framingRadiusUnits: 1, datasets: [{
      id: 'optical', label: 'Optical', title: 'Fixture optical image', description: 'Structural test fixture', sourceUrl: 'https://example.test/source',
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] },
      volume: { schema: PREPARED_CSS_VOLUME_SCHEMA, id, frame, anchors: [], provenance: {}, approximation: {},
        resources: [{ path: 'slice.webp', bytes: image.length, width: 1, height: 1 }],
        stacks: ['x', 'y', 'z'].map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: 'slice.webp', widthPx: 1, heightPx: 1,
          style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })) },
    }] };
  // The bank as a preparation stores it: its index, the dataset's volume, its stars and its record.
  const bankFiles = [...volumeDatasetBankFiles(bank as unknown as PreparedVolumeDatasets)], preview = `/scenes/${id}/preview.webp`;
  const descriptor = { schema: OBJECT_SCHEMA, id, type: 'volume-dataset-bank', properties: { frame },
    prepared: { format: PREPARED_VOLUME_DATASET_INDEX_SCHEMA, url: 'prepared/datasets.json' } };
  // The dataset's own source record: the manifest input that names it.
  const manifest = { schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs: [{ id: 'image', datasetId: 'optical', path: '.local/fixture/image.tif',
    origin: 'https://example.test/source', sourceUrl: 'https://example.test/source', title: 'Fixture image', credit: 'Fixture', acquisition: 'Fixture',
    sourceBinding: { kind: 'local', reason: 'Structural test fixture' }, dependencies: [] }], documents: [], generatedIntermediates: [] };
  const presentation = { schema: 'cssearth-volume-presentation@2', objectId: id, defaultDataset: 'optical', controls: [{
    id: 'optical', label: 'Optical', title: 'Fixture optical image', summary: 'Structural test fixture', thumbnailUrl: preview,
    texture: { url: preview, width: 1, height: 1, attribution: { label: 'Fixture', url: 'https://example.test/source' } },
  }] };
  const directory = `src/objects/${id}`;
  const files: [string, string | Uint8Array][] = [
    [`${directory}/object.json`, JSON.stringify(descriptor)], ...bankFiles.map(([name, bytes]): [string, Uint8Array] => [`${directory}/prepared/${name}`, bytes]),
    [`${directory}/source/manifest.json`, JSON.stringify(manifest)], [`${directory}/prepared/presentation.json`, JSON.stringify(presentation)],
    [`${directory}/inventory.json`, JSON.stringify({ schema: 'cssearth-inventory@1', assets: [
      { location: 'public', filename: 'preview.webp', bytes: image.length, sha256: address(image) },
      ...bankFiles.map(([name, bytes]) => ({ location: 'prepared', filename: name, bytes: bytes.byteLength, sha256: address(bytes) })),
      { location: 'prepared', filename: 'presentation.json', bytes: Buffer.byteLength(JSON.stringify(presentation)), sha256: address(JSON.stringify(presentation)) },
      { location: 'prepared', filename: 'slice.webp', bytes: image.length, sha256: address(image) },
    ] })],
    [`${directory}/source/presentation.json`, JSON.stringify({ schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, objectId: id,
      name: `${id} fixture`, defaultDataset: 'optical', bank: { path: `${directory}/prepared/datasets.json` }, sharedInputs: [],
      datasets: [{ id: 'optical', label: 'Optical', title: 'Fixture optical image', description: 'Structural test fixture', summary: 'Structural test fixture',
        detail: '1 × 1 px', facts: [], input: 'image', preview: { path: '.local/fixture/preview.jpg', url: 'https://example.test/preview.jpg' } }] })],
    [`${directory}/prepared/slice.webp`, image], [`site/public${preview}`, image],
  ];
  for (const [path, bytes] of files) { const file = resolve(root, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes); }
  return { directory: resolve(root, directory), files, bank, descriptor, manifest, presentation };
}
