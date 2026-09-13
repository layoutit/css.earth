/** Restore the exact published figure into the ignored cache; no geometry is prepared here. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { extractJpegFromEps } from './source-figure.js';
import { loadKinematicEvidence } from './server.js';

export async function prepareKinematicFigure(root: string, sourcePath: string): Promise<{ path: string; sha256: string }> {
  const { evidence } = await loadKinematicEvidence(root, sourcePath), citation = evidence.citation;
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const output = resolve(root, evidence.figure.cachePath);
  try { const bytes = await readFile(output); if (sha(bytes) === citation.figureSha256) return { path: output, sha256: citation.figureSha256 }; } catch { /* Restore a missing prepared input. */ }
  const response = await fetch(citation.sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source archive HTTP ${response.status}.`);
  const archive = new Uint8Array(await response.arrayBuffer());
  if (sha(archive) !== citation.sourceArchiveSha256) throw new Error('Source archive hash mismatch.');
  const tar = gunzipSync(archive, { maxOutputLength: 16777216 }); let eps: Buffer | null = null;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, '');
    if (!name) break;
    const size = Number.parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, '').trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid source tar member.');
    if (name === citation.member) { eps = tar.subarray(offset + 512, offset + 512 + size); break; }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!eps || sha(eps) !== citation.memberSha256) throw new Error('Source figure member hash mismatch.');
  const jpeg = extractJpegFromEps(eps.toString());
  if (sha(jpeg) !== citation.figureSha256) throw new Error('Decoded figure hash mismatch.');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(resolve(dirname(output), 'meaburn2005-source.tar.gz'), archive);
  await writeFile(output, jpeg);
  return { path: output, sha256: citation.figureSha256 };
}
