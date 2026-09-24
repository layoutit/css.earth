/**
 * Shared reference banks: one pinned copy of a standard table every body reads, under `src/references/<set>/`, instead of
 * a copy in each body that uses it. A bank's `manifest.json` has the shape of a body's source manifest and is verified the
 * same way, under the identity `reference-<set>`, as the SPICE kernel banks are (tools/spice/kernel-bank.mts).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';

export const REFERENCE_BANK_ROOT = resolve(import.meta.dirname, '../../src/references');
const SET_ID = /^[a-z][a-z0-9-]*$/u;

export function referenceBankRoot(set: string) {
  if (!SET_ID.test(set)) throw new TypeError(`Invalid reference bank id: ${set}`);
  return resolve(REFERENCE_BANK_ROOT, set);
}

/** A bank's manifest, validated and verifiable like a body's source manifest. */
export const openReferenceBank = (set: string) =>
  createSourceManifest({ objectId: `reference-${set}`, objectName: `${set} reference bank`, sourceRoot: referenceBankRoot(set) });

/** A pinned file of a bank, checked against its pin. */
export async function readReferenceBankFile(set: string, path: string) {
  const bank = await openReferenceBank(set);
  await bank.validatePath(path);
  return readFile(resolve(referenceBankRoot(set), path));
}

/** The CIE 1931 2° colour-matching table every photometric colour is computed with. */
export const CIE_1931_2DEG = Object.freeze({ set: 'cie-1931-2deg', path: 'CIE_xyz_1931_2deg.csv' });
export const readCie1931ColorMatching = () => readReferenceBankFile(CIE_1931_2DEG.set, CIE_1931_2DEG.path);
