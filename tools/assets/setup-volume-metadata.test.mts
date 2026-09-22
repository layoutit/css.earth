import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { installRuntimeAssets } from './setup.mts';
import { preparedVolumeMetadataAssets } from './setup-volume-metadata.mts';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('catalogue bootstrap restores prepared volume and context metadata while leaving dataset bytes on R2', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-volume-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = resolve(root, 'src/objects/m31');
  const files = new Map([
    ['presentation.json', Buffer.from('{"schema":"prepared-presentation"}')],
    ['provenance.json', Buffer.from('{"schema":"prepared-provenance"}')],
    ['datasets/large.webp', Buffer.from('dataset fixture that must remain remote')],
  ]);
  const sourcePresentation = resolve(base, 'source/presentation.json');
  await mkdir(dirname(sourcePresentation), { recursive: true });
  await writeFile(sourcePresentation, JSON.stringify({ schema: 'cssearth-volume-presentation-source@1', objectId: 'm31' }));
  await writeFile(resolve(base, 'runtime-assets.json'), JSON.stringify({
    schema: 'cssm31-runtime-assets@1', resourceRoot: 'prepared',
    assets: [...files].map(([filename, bytes]) => ({ filename, bytes: bytes.length, sha256: sha256(bytes) })),
  }));
  const preparedBase = resolve(root, 'src/objects/helix');
  const preparedSource = resolve(preparedBase, 'source/presentation.json');
  await mkdir(dirname(preparedSource), { recursive: true });
  await writeFile(preparedSource, JSON.stringify({ schema: 'cssearth-volume-presentation-source@1', objectId: 'helix' }));
  await writeFile(resolve(preparedBase, 'runtime-assets.json'), JSON.stringify({
    schema: 'csshelix-runtime-assets@1', resourceRoot: 'prepared',
    assets: [{ filename: 'datasets/large.webp', location: 'public', bytes: files.get('datasets/large.webp')!.length,
      sha256: sha256(files.get('datasets/large.webp')!) }],
  }));
  await writeFile(resolve(preparedBase, 'prepared-assets.json'), JSON.stringify({
    schema: 'csshelix-prepared-assets@1', resourceRoot: 'prepared',
    assets: ['presentation.json', 'provenance.json'].map(filename => ({ filename, bytes: files.get(filename)!.length,
      sha256: sha256(files.get(filename)!) })),
  }));
  const contextBase = resolve(root, 'src/objects/nearby-universe');
  const contextSource = resolve(contextBase, 'source/presentation.json');
  await mkdir(dirname(contextSource), { recursive: true });
  await writeFile(contextSource, JSON.stringify({ provenance: { products: [] } }));
  await writeFile(resolve(contextBase, 'runtime-assets.json'), JSON.stringify({
    schema: 'cssnearby-universe-runtime-assets@1', resourceRoot: 'prepared',
    assets: [...files].map(([filename, bytes]) => ({ filename, bytes: bytes.length, sha256: sha256(bytes) })),
  }));
  const sourceOnly = resolve(root, 'src/objects/local-group/source/presentation.json');
  await mkdir(dirname(sourceOnly), { recursive: true });
  await writeFile(sourceOnly, JSON.stringify({ provenance: { products: [] } }));

  const selected = await preparedVolumeMetadataAssets(root);
  assert.deepEqual(selected.ids, ['helix', 'm31', 'nearby-universe']);
  assert.deepEqual(selected.assets.map(asset => `${asset.id}/${asset.filename}`).sort(), [
    'helix/presentation.json', 'helix/provenance.json', 'm31/presentation.json', 'm31/provenance.json',
    'nearby-universe/presentation.json', 'nearby-universe/provenance.json',
  ]);
  const requested: string[] = [];
  assert.deepEqual(await installRuntimeAssets(selected.assets, { fetcher: async url => {
    const asset = selected.assets.find(asset => asset.url === String(url));
    assert.ok(asset);
    requested.push(asset.filename);
    return new Response(files.get(asset.filename));
  } }), { installed: 6, reused: 0, skipped: 0 });
  assert.deepEqual(requested.sort(), ['presentation.json', 'presentation.json', 'presentation.json', 'provenance.json', 'provenance.json', 'provenance.json']);
  assert.equal(await readFile(resolve(base, 'prepared/presentation.json'), 'utf8'), files.get('presentation.json')!.toString());
  assert.equal(await readFile(resolve(preparedBase, 'prepared/provenance.json'), 'utf8'), files.get('provenance.json')!.toString());
  assert.equal(await readFile(resolve(contextBase, 'prepared/provenance.json'), 'utf8'), files.get('provenance.json')!.toString());
  await assert.rejects(readFile(resolve(base, 'prepared/datasets/large.webp')), { code: 'ENOENT' });
  await assert.rejects(readFile(resolve(root, 'public/scenes/helix/datasets/large.webp')), { code: 'ENOENT' });
});
