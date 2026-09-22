import { isArray } from '../../../../src/platform/is-array.mts';
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { isPreparedCityAssetUrl } from "../../../../src/renderers/css/dist/preparation.js";

import type { CityCoveragePlan } from '../contracts.mts';
import { parsePublishedCoverage, parseIndexHead } from '../source-records.mts';
import { hasErrorCode } from '../../../sources/source-values.mts';
export async function readPublishedCoverage(path: string | URL) {
  const bytes = await readFile(path).catch((error: unknown) => hasErrorCode(error,"ENOENT") ? null : Promise.reject(error));
  if (!bytes) return null;
  const snapshot = parsePublishedCoverage(JSON.parse(gunzipSync(bytes).toString("utf8")));
  validateSnapshot(snapshot);
  return snapshot;
}

export function assembleCityCoveragePlan<T extends CityCoveragePlan>(base: T, value: unknown, {assetPath=base.assetPath}={}) {
  const snapshot = value ? parsePublishedCoverage(value) : null;
  if (!snapshot) return base;
  validateSnapshot(snapshot);
  if (snapshot.dataset !== base.dataset) throw new Error("City coverage dataset mismatch.");
  const roots = new Map(base.roots.map(head => [head.key,head]));
  for (const receipt of snapshot.faces) {
    const head = parseIndexHead(receipt.heads?.[0]), ref = head.directory;
    if (receipt.heads?.length !== 1 || receipt.publish?.mode !== "publish-and-verify" || head?.key !== receipt.face.key ||
        head.level !== 0 || head.stub !== true || !Number.isSafeInteger(ref?.bytes) || ref.bytes < 1 ||
        !ref || !isPreparedCityAssetUrl({...base,assetPath},ref.url,"index",ref.sha256)) {
      throw new Error("City coverage requires a verified published head.");
    }
    roots.set(head.key,head);
  }
  return { ...base, qualification:"Partial world coverage from verified published regions; source gaps remain.",
    roots:[...roots.values()].sort((a,b)=>a.key.localeCompare(b.key)),
    coverage:{ publishedFaces:snapshot.faces.length, expectedFaces:snapshot.expectedFaces,
      catalogSha256:snapshot.catalogSha256,
      publishedPages:snapshot.faces.reduce((sum,face)=>sum+face.pages,0) } };
}

function validateSnapshot(snapshot: ReturnType<typeof parsePublishedCoverage>) {
  if (snapshot.schema !== "cssearth-published-city-coverage@1" || !isArray(snapshot.faces) ||
      !Number.isSafeInteger(snapshot.expectedFaces) || snapshot.expectedFaces < snapshot.faces.length ||
      !/^[a-f0-9]{64}$/u.test(snapshot.catalogSha256 ?? "") ||
      snapshot.faces.some(receipt => !/^0-\d+-\d+$/u.test(receipt.face?.key ?? "") ||
        !Number.isSafeInteger(receipt.pages) || receipt.pages < 1) ||
      new Set(snapshot.faces.map(receipt => receipt.face.key)).size !== snapshot.faces.length) {
    throw new Error("Invalid pinned city coverage snapshot.");
  }
}
