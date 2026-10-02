/**
 * Shared reference banks: one copy of a standard table every body reads, under `src/references/<set>/`, instead of
 * a copy in each body that uses it. A bank's `manifest.json` has the shape of a body's source manifest and is verified the
 * same way, under the identity `reference-<set>`, as the SPICE kernel banks are (`kernel-banks.ts` in objects/cameras).
 */
import { discoverRoot } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '@cssearth/objects/node';

/** The banks' directory, found upward from this module: it runs from its bake source and bundled into packages/bake/dist. */
function findReferenceBankRoot(from: string): string {
  return resolve(discoverRoot({ strategy: 'ancestor-marker', startDirectory: from, marker: 'src/references',
    missing: { behavior: 'throw', error: () => new Error(`No src/references directory above ${from}.`) } }), 'src/references');
}

// Found on first use rather than at import, so importing the sources entry never needs a checkout's src/references.
let bankRoot: string | undefined;
const referenceBanksRoot = () => bankRoot ??= findReferenceBankRoot(import.meta.dirname);
const SET_ID = /^[a-z][a-z0-9-]*$/u;

export function referenceBankRoot(set: string) {
  if (!SET_ID.test(set)) throw new TypeError(`Invalid reference bank id: ${set}`);
  return resolve(referenceBanksRoot(), set);
}

/** A bank's manifest, validated and verifiable like a body's source manifest. */
export const openReferenceBank = (set: string) =>
  createSourceManifest({ objectId: `reference-${set}`, objectName: `${set} reference bank`, sourceRoot: referenceBankRoot(set) });

/** A file the bank's manifest declares, read after the manifest validates its path. */
export async function readReferenceBankFile(set: string, path: string) {
  const bank = await openReferenceBank(set);
  await bank.validatePath(path);
  return readFile(resolve(referenceBankRoot(set), path));
}

/** The CIE 1931 2° colour-matching table every photometric colour is computed with. */
export const CIE_1931_2DEG = Object.freeze({ set: 'cie-1931-2deg', path: 'CIE_xyz_1931_2deg.csv' });
export const readCie1931ColorMatching = () => readReferenceBankFile(CIE_1931_2DEG.set, CIE_1931_2DEG.path);
