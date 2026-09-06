import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safe = name => typeof name === 'string' && /^[a-z0-9][a-z0-9@._-]*$/u.test(name);

/** Validate consumer JSON before publication; private preparation folders stay staged. */
export async function readPreparedJsonOutputs(directory) {
  const outputs = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!entry.isFile() || !entry.name.endsWith('.json')) throw new TypeError('Prepared object output must contain only regular JSON files.');
    const path = resolve(directory, entry.name);
    JSON.parse(await readFile(path, 'utf8'));
    outputs.push({ filename: entry.name, path });
  }
  if (!outputs.length) throw new TypeError('Prepared object output has no JSON data.');
  return outputs.sort((left, right) => left.filename.localeCompare(right.filename));
}

/** Publish a complete verified image set, retaining replaced files for rollback. */
export async function publishPreparedAssets({ id, stage, destination, previous, manifest, recovery }) {
  if (manifest.schema !== `css${id}-runtime-assets@1` || !manifest.assets?.length) throw new TypeError('Invalid prepared publication manifest.');
  const names = new Set();
  for (const asset of manifest.assets) {
    if (!safe(asset.filename) || names.has(asset.filename)) throw new TypeError('Unsafe or duplicate prepared publication asset.');
    names.add(asset.filename);
    const bytes = await readFile(resolve(stage, asset.filename));
    if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256) throw new Error(`Prepared publication asset drifted: ${asset.filename}`);
  }
  await mkdir(destination, { recursive: true });
  const known = new Set(previous?.assets?.map(asset => asset.filename) ?? []);
  const entries = await readdir(destination, { withFileTypes: true });
  for (const entry of entries) if (!entry.isFile() || !known.has(entry.name)) throw new Error(`Unowned canonical asset: ${entry.name}`);
  const prior = new Set(entries.map(entry => entry.name));
  await mkdir(recovery, { recursive: true });
  for (const name of prior) await copyFile(resolve(destination, name), resolve(recovery, name), constants.COPYFILE_FICLONE);
  const published = [];
  try {
    for (const name of names) {
      const temporary = resolve(destination, `${name}.partial-publication`);
      await copyFile(resolve(stage, name), temporary, constants.COPYFILE_FICLONE);
      await rename(temporary, resolve(destination, name));
      published.push(name);
    }
    for (const name of prior) if (!names.has(name)) await rm(resolve(destination, name));
  } catch (error) {
    for (const name of names) await rm(resolve(destination, `${name}.partial-publication`), { force: true });
    for (const name of published) if (!prior.has(name)) await rm(resolve(destination, name), { force: true });
    for (const name of prior) await copyFile(resolve(recovery, name), resolve(destination, name), constants.COPYFILE_FICLONE);
    throw error;
  }
  return { published: names.size, retired: [...prior].filter(name => !names.has(name)), recovery };
}
