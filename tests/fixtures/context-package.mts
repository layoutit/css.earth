import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Small structural fixture: these bytes test installation identity, not image decoding. */
export async function writeContextPackage(root: string, id: string) {
  const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const image = Buffer.from('fixture texture bytes'), digest = hash(image);
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const bank = { schema: 'cssearth-prepared-object@1', id, type: 'volume-lens-bank', format: 'cssearth-volume-lenses@1',
    data: { schema: 'cssearth-volume-lenses@1', id, defaultLens: 'optical', framingRadiusUnits: 1, lenses: [{
      id: 'optical', label: 'Optical', title: 'Fixture optical image', description: 'Structural test fixture', sourceUrl: 'https://example.test/source',
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] },
      volume: { schema: 'cssearth-css-volume@1', id, frame, anchors: [], provenance: {}, approximation: {},
        resources: [{ path: 'slice.webp', sha256: digest, bytes: image.length, width: 1, height: 1 }],
        stacks: ['x', 'y', 'z'].map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: 'slice.webp', widthPx: 1, heightPx: 1,
          style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })) },
    }] } };
  const bankBytes = JSON.stringify(bank), bankHash = hash(bankBytes), preview = `/scenes/${id}/preview.webp`;
  const descriptor = { schema: 'cssearth-object@1', id, type: 'volume-lens-bank', properties: { frame },
    prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json', sha256: bankHash } };
  const provenance = { schema: 'cssearth-object-provenance@3', objectId: id, basis: 'recovered',
    manifest: { path: 'source/manifest.json', sha256: digest }, generator: { path: 'fixture', sha256: digest, bindingsSha256: digest },
    sources: [{ id: 'image', lensId: 'optical', path: 'source/image', origin: 'Fixture', credit: 'Fixture', acquisition: 'Fixture',
      sha256: digest, bytes: image.length, dependencies: [], verification: 'manifest-pin' }],
    recipes: [{ id: 'mapping', path: 'source/recipe.json', sha256: digest, parameters: {} }],
    products: [{ id: 'optical', lensIds: ['optical'], label: 'Optical', process: 'Fixture', recipe: 'mapping', selector: '', recipeDependencies: ['mapping'],
      inputs: ['image'], parents: [], outputs: [
        { url: `src/objects/${id}/prepared/lenses.json`, sha256: bankHash, bytes: Buffer.byteLength(bankBytes), verification: 'descriptor-pin' },
        { url: preview, sha256: digest, bytes: image.length, verification: 'descriptor-pin' },
      ] }], coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [] } };
  const presentation = { schema: 'cssearth-volume-presentation@1', objectId: id, defaultLens: 'optical', controls: [{
    id: 'optical', label: 'Optical', title: 'Fixture optical image', summary: 'Structural test fixture', thumbnailUrl: preview,
    texture: { url: preview, width: 1, height: 1, attribution: { label: 'Fixture', url: 'https://example.test/source' } },
  }] };
  const directory = `src/objects/${id}`;
  const files: [string, string | Uint8Array][] = [
    [`${directory}/object.json`, JSON.stringify(descriptor)], [`${directory}/prepared/lenses.json`, bankBytes],
    [`${directory}/prepared/provenance.json`, JSON.stringify(provenance)], [`${directory}/prepared/presentation.json`, JSON.stringify(presentation)],
    [`${directory}/runtime-assets.json`, JSON.stringify({ schema: `css${id}-runtime-assets@1`, resourceRoot: 'prepared',
      assets: [{ filename: 'preview.webp', location: 'public', bytes: image.length, sha256: digest }] })],
    [`${directory}/source/presentation.json`, JSON.stringify({ schema: 'cssearth-volume-presentation-source@1', objectId: id,
      name: `${id} fixture`, defaultLens: 'optical', lenses: [{ id: 'optical' }] })],
    [`${directory}/prepared/slice.webp`, image], [`public${preview}`, image],
  ];
  for (const [path, bytes] of files) { const file = resolve(root, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes); }
  return { directory: resolve(root, directory), files, bank, descriptor, provenance, presentation };
}
