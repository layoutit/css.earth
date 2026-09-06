import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PIN = Object.freeze({
  version: '1.145.0',
  commit: '845a06b71d37a38604a8045a479dd3567453009a',
  url: 'https://registry.npmjs.org/cesium/-/cesium-1.145.0.tgz',
  integrity: 'sha512-6Azix8b5LPpoVSx8XQ6zPztpluJVmq+CEO3W2rOWxtc6bri6Nc9MvCYhKmTW1LAEwfisV7yzNgfulCXw9842+g==',
});
export const project = new URL('../../', import.meta.url);
export const installation = new URL(`.local/cesium-oracle/${PIN.version}/`, project);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// A test-only prebuilt distribution. Never imported by the application, never
// installed as a production dependency. The original LICENSE stays beside it.
export async function acquire() {
  await mkdir(installation, { recursive: true });
  const archive = new URL('cesium.tgz', installation);
  let bytes;
  try { bytes = await readFile(archive); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(PIN.url, { signal: AbortSignal.timeout(60000) });
    assert.ok(response.ok, `Cesium download: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), PIN.integrity, 'Cesium archive integrity');
  await writeFile(archive, bytes);
  // Re-extract the verified archive: a receipt alone does not validate local JS.
  const staging = new URL(`extract-${process.pid}/`, installation);
  await mkdir(staging, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', fileURLToPath(archive), '-C', fileURLToPath(staging), 'package/Build/CesiumUnminified', 'package/LICENSE.md', 'package/package.json']);
    await rm(new URL('package/', installation), { recursive: true, force: true });
    await rename(new URL('package/', staging), new URL('package/', installation));
  } finally { await rm(staging, { recursive: true, force: true }); }
  const bundle = await readFile(new URL('package/Build/CesiumUnminified/Cesium.js', installation));
  const license = await readFile(new URL('package/LICENSE.md', installation));
  const receipt = { ...PIN, archiveBytes: bytes.length, archiveSha256: sha256(bytes), bundleSha256: sha256(bundle), licenseSha256: sha256(license) };
  await writeFile(new URL('receipt.json', installation), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await acquire(), null, 2));
