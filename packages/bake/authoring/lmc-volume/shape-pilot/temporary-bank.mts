/** Data-only transaction for real-site evidence. No renderer or shared-package changes. */
import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { validatePreparedCssVolume, parseObjectDescriptor, type PreparedCssVolume } from '@cssearth/objects';
import { readVolumeDatasetBank, writeVolumeDatasetBank, inventoryPreparedAssets } from '@cssearth/objects/node';
import { prepareCatalog } from '../../../../../site/build/prepare/catalog/prepare-catalog.mts';
import { need } from '../inputs.mts';
import { SHAPE_DIR } from './source.mts';

const object = 'src/objects/lmc-volume/', prepared = object + 'prepared', backup = SHAPE_DIR + 'accepted-backup', stage = SHAPE_DIR + 'site-stage';
async function exists(path: string) { try { await access(path); return true; } catch (e) { if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return false; throw e; } }

async function restore() {
  need(await exists(backup), 'The accepted-bank backup is missing');
  const bank = await readVolumeDatasetBank(backup), inventory = await readFile(SHAPE_DIR + 'original/inventory.json'), context = await readFile(SHAPE_DIR + 'original/context-assets.json'), descriptor = await readFile(SHAPE_DIR + 'original/object.json');
  await rm(prepared, { recursive: true, force: true }); await rename(backup, prepared); await writeFile(object + 'inventory.json', inventory); await writeFile(object + 'object.json', descriptor); await prepareCatalog();
  need(isDeepStrictEqual(await readVolumeDatasetBank(prepared), bank) && (await readFile(object + 'inventory.json')).equals(inventory) && (await readFile(object + 'object.json')).equals(descriptor) && (await readFile('site/prepared/prepared-context-bank-assets.json')).equals(context), 'The accepted bank did not restore exactly');
  await writeFile(SHAPE_DIR + 'restored.json', JSON.stringify({ complete: true, bankRestored: true, inventoryBytesIdentical: true, descriptorBytesIdentical: true, contextTableBytesIdentical: true }) + '\n');
  console.log('FINITE_ACCEPTED_BANK_RESTORED');
}

export async function withTemporaryBank(input: PreparedCssVolume, capture: (origin: string) => Promise<void>, interrupt = false, componentOnly = false) {
  if (await exists(backup)) await restore();
  const original = await readVolumeDatasetBank(prepared), native = original.datasets[0]!.volume;
  need(native.impostors, 'Preserve the installed near/far rendering path');
  // The body's existing distant backing also reads the Sun-facing picture, independently of volume impostors.
  const farResources = native.resources.filter(r => r.path.startsWith('l36-far/') && (!componentOnly || r.path === 'l36-far/earth.png'));
  const volume = validatePreparedCssVolume({ ...input, ...(componentOnly ? {} : { impostors: native.impostors }), resources: [...input.resources, ...farResources] });
  await mkdir(SHAPE_DIR + 'original', { recursive: true });
  await writeFile(SHAPE_DIR + 'original/inventory.json', await readFile(object + 'inventory.json'));
  await writeFile(SHAPE_DIR + 'original/context-assets.json', await readFile('site/prepared/prepared-context-bank-assets.json'));
  await writeFile(SHAPE_DIR + 'original/object.json', await readFile(object + 'object.json'));
  await rm(stage, { recursive: true, force: true }); await cp(prepared, stage, { recursive: true });
  const wanted = new Set(volume.resources.map(r => r.path));
  for (const r of native.resources) if (!wanted.has(r.path)) await rm(stage + '/' + r.path, { force: true });
  for (const r of input.resources) {
    const id = ['cloud', 'shell', 'background'].find(id => r.path.startsWith('l36-shape-' + id + '/')); need(id, 'Unknown finite shape texture');
    const path = SHAPE_DIR + 'banks/' + id + '/' + r.path.slice(('l36-shape-' + id + '/').length), bytes = await readFile(path); need(bytes.length === r.bytes, 'Prepared shape texture size changed');
    await mkdir(dirname(stage + '/' + r.path), { recursive: true }); await writeFile(stage + '/' + r.path, bytes);
  }
  await writeVolumeDatasetBank(stage, { ...original, datasets: [{ ...original.datasets[0]!, volume, stars: { ...original.datasets[0]!.stars, frame: volume.frame } }] });
  let server: ReturnType<typeof spawn> | undefined;
  try {
    await rename(prepared, backup);
    if (interrupt) { await writeFile(SHAPE_DIR + 'interruption.json', JSON.stringify({ intentional: true, checkpoint: 'accepted directory preserved before swap' }) + '\n'); process.kill(process.pid, 'SIGKILL'); }
    await rename(stage, prepared);
    const descriptor = parseObjectDescriptor(JSON.parse((await readFile(SHAPE_DIR + 'original/object.json')).toString('utf8')));
    await writeFile(object + 'object.json', JSON.stringify(parseObjectDescriptor({ ...descriptor, properties: { ...descriptor.properties, frame: volume.frame } }), null, 2) + '\n');
    await inventoryPreparedAssets({ objectId: 'lmc-volume', objectDirectory: object }); await prepareCatalog();
    const origin = 'http://127.0.0.1:4313';
    let occupied = false; try { occupied = (await fetch(origin)).ok; } catch {} need(!occupied, 'The pilot port is already occupied');
    server = spawn('pnpm', ['exec', 'astro', 'dev', '--config', 'site/astro.config.mts', '--host', '127.0.0.1', '--port', '4313', '--ignore-lock'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' } });
    for (const stream of [server.stdout, server.stderr]) stream?.on('data', (v: Buffer) => process.stdout.write(v));
    const deadline = Date.now() + 120000;
    while (true) { need(server.exitCode === null, 'The candidate site exited'); try { if ((await fetch(origin + '/lmc/')).ok) break; } catch {} need(Date.now() < deadline, 'The candidate site did not start'); await new Promise(r => setTimeout(r, 500)); }
    await capture(origin);
  } finally {
    if (server?.pid) { const pid = server.pid; try { process.kill(-pid, 'SIGTERM'); } catch {} await new Promise(r => setTimeout(r, 500)); }
    if (await exists(backup)) await restore();
  }
}
