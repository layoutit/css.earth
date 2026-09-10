import { isArray } from '../../../src/platform/is-array.mts';
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { shape, text, number, array, parseReleaseFile } from './source-records.mts';
type ReleaseFile = ReturnType<typeof parseReleaseFile>;
export const WMTS_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const WMTS_SAMPLE_FILES = ["5-10-19.pack", "8-86-154.pack"];

export function releaseFiles(value: unknown, sample = false) {
  const release = shape({schema:text,version:text,bytes:number,files:array(parseReleaseFile)})(value);
  if (release.schema !== "cssearth-global-wmts-release@1" ||
      !/^[a-f0-9]{16}$/u.test(release.version ?? "") || !isArray(release.files)) {
    throw new Error("Invalid prepared release inventory.");
  }
  const seen = new Set(); let total = 0;
  for (const file of release.files) {
    const match = /^(5|8)-(\d+)-(\d+)\.pack$/u.exec(file.filename ?? "");
    if (!match || seen.has(file.filename) ||
        Number(match[2]) >= 2 ** Number(match[1]) || Number(match[3]) >= 2 ** Number(match[1]) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 32 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/u.test(file.sha256 ?? "")) throw new Error("Invalid prepared pack inventory entry.");
    seen.add(file.filename); total += file.bytes;
  }
  if (!seen.size || total !== release.bytes) throw new Error("Prepared release byte total mismatch.");
  if (sample && WMTS_SAMPLE_FILES.some(name => !seen.has(name))) throw new Error("Missing Buenos Aires sample packs.");
  return release.files.filter(file => !sample || WMTS_SAMPLE_FILES.includes(file.filename));
}

export async function verifyLocalPack(directory: string, file: ReleaseFile) {
  const path = join(directory, file.filename), info = await stat(path);
  if (!info.isFile() || info.size !== file.bytes) throw new Error(`Prepared pack size mismatch: ${file.filename}`);
  const sha = createHash("sha256"), md5 = createHash("md5");
  for await (const chunk of createReadStream(path)) { sha.update(chunk); md5.update(chunk); }
  if (sha.digest("hex") !== file.sha256) throw new Error(`Prepared pack hash mismatch: ${file.filename}`);
  return { ...file, path, md5: md5.digest("hex") };
}

export async function publishedPackMatches(url: string, file: ReleaseFile & { md5: string }, { fetcher = fetch, origin = "https://css.earth" } = {}) {
  const response = await fetcher(url, { method: "HEAD", headers: { Origin: origin, "Accept-Encoding": "identity" },
    signal: AbortSignal.timeout(30000) });
  if (response.status === 404) return false;
  if (response.status !== 200 || Number(response.headers.get("content-length")) !== file.bytes ||
      response.headers.get("etag")?.replaceAll('"', "") !== file.md5 ||
      response.headers.get("content-type")?.split(";")[0] !== "application/octet-stream" ||
      response.headers.get("content-encoding") ||
      response.headers.get("cache-control")?.replaceAll(" ", "") !== WMTS_CACHE_CONTROL.replaceAll(" ", "")) {
    throw new Error(`Published immutable pack differs: ${file.filename} (HTTP ${response.status}).`);
  }
  return true;
}
