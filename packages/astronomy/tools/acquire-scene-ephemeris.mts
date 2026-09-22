// Explicit acquisition only. Preparation reads the committed raw responses
// offline. Re-running this command updates source pins and requires review.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { SCENE_EPHEMERIS_DIRECTORY, loadSceneEpochEphemeris } from './scene-ephemeris.mts';

import { parseSceneManifest } from './lib/ephemeris-records.mts';
const url = new URL('manifest.json', SCENE_EPHEMERIS_DIRECTORY);
const manifest = parseSceneManifest(JSON.parse(await readFile(url, 'utf8')));
const responses = [];
for (const record of manifest.records) {
  const result = await fetch(record.url);
  if (!result.ok) throw new Error(`Horizons ${record.id}: HTTP ${result.status}`);
  const bytes = Buffer.from(await result.arrayBuffer());
  if (!bytes.toString('utf8').includes('$$SOE')) throw new Error(`Horizons supplied no state for ${record.id}.`);
  responses.push({ record, bytes });
}
manifest.retrievedAt = new Date().toISOString();
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
// Validate the complete new closure before replacing any committed source.
const temporary = await mkdtemp(fileURLToPath(new URL('.acquire-', SCENE_EPHEMERIS_DIRECTORY)));
try {
  const directory = pathToFileURL(`${temporary}/`);
  await writeFile(new URL('manifest.json', directory), manifestText);
  for (const {record, bytes} of responses) await writeFile(new URL(record.path, directory), bytes);
  await loadSceneEpochEphemeris(manifest.epochJdTt, directory);
  for (const {record, bytes} of responses) await writeFile(new URL(record.path, SCENE_EPHEMERIS_DIRECTORY), bytes);
  await writeFile(url, manifestText);
} finally { await rm(temporary, { recursive: true, force: true }); }
console.log(`Retained and verified ${responses.length} scene-epoch Horizons responses.`);
