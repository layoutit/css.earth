import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLANET_TITLE_RECIPE as recipe } from '../../src/platform/planet-title-recipe.mts';
import { hasErrorCode } from '../sources/source-values.mts';

/** Restore only the small font needed to bootstrap the shared shell. */
export async function restoreTitleFont({
  projectRoot = resolve(import.meta.dirname, '../..'),
  fetchBytes = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Title font download failed: HTTP ${response.status}.`);
    return new Uint8Array(await response.arrayBuffer());
  },
} = {}) {
  const destination = resolve(projectRoot, recipe.checkedFontPath);
  let bytes: Uint8Array;
  let missing = false;
  try { bytes = await readFile(destination); }
  catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error;
    bytes = await fetchBytes(recipe.sourceUrl);
    missing = true;
  }
  if (missing) {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  return destination;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await restoreTitleFont();
}
