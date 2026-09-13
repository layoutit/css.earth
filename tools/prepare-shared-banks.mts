import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OBJECTS } from '../site/objects.mts';
import { pruneSharedBanks, restorePreparedShared, syncPreparedShared } from '../src/platform/prepared-shared-banks.mts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function chooseIds(ids: readonly string[] | undefined): string[] {
  const chosen = ids?.length ? [...ids] : OBJECTS.map(({ id }) => id);
  if (new Set(chosen).size !== chosen.length || chosen.some(id => !OBJECTS.some(object => object.id === id))) {
    throw new TypeError('Choose registered object ids.');
  }
  return chosen;
}

/** Derive every object's checked-in twins and shared banks from its full prepared files. */
export async function syncSharedBanks(ids?: readonly string[], root = projectRoot) {
  const chosen = chooseIds(ids);
  const referenced = new Set<string>();
  let twins = 0, banks = 0;
  for (const id of chosen) {
    const result = await syncPreparedShared(root, resolve(root, 'src/objects', id, 'prepared'));
    twins += result.twins; banks += result.banks;
    for (const key of result.references) referenced.add(key);
  }
  // Only a complete sync knows which banks nothing references any more.
  const pruned = ids?.length ? 0 : await pruneSharedBanks(root, referenced);
  return { objects: chosen.length, twins, banks, pruned };
}

/** Rebuild the full prepared files from the checked-in twins and banks; never bakes. */
export async function restoreSharedBanks(ids?: readonly string[], root = projectRoot) {
  let written = 0, reused = 0;
  const chosen = chooseIds(ids);
  for (const id of chosen) {
    const result = await restorePreparedShared(root, resolve(root, 'src/objects', id, 'prepared'));
    written += result.written; reused += result.reused;
  }
  return { objects: chosen.length, written, reused };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, ...rest] = process.argv.slice(2);
  const repin = rest.includes('--repin'), ids = rest.filter(argument => !argument.startsWith('--'));
  if (mode === 'sync') {
    const result = await syncSharedBanks(ids);
    if (repin) {
      const { repinObjectJson } = await import('./prepare-object-json.mts');
      let repinned = 0;
      for (const id of chooseIds(ids)) if (await repinObjectJson(id)) repinned++;
      console.log(JSON.stringify({ ...result, repinned }));
    } else console.log(JSON.stringify(result));
  } else if (mode === 'restore') console.log(JSON.stringify(await restoreSharedBanks(ids)));
  else throw new TypeError('Usage: prepare-shared-banks <sync [--repin] | restore> [object ids]');
}
