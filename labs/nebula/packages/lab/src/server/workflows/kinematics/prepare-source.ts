/** Restore the published figure into the ignored cache; no geometry is prepared here. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { extractJpegFromEps } from '@cssearth/nebula-reconstruction/methods/kinematics/source-figure';
import { loadKinematicEvidence } from '../../routes/kinematics.ts';

export async function prepareKinematicFigure(root: string, sourcePath: string): Promise<{ path: string }> {
  const { evidence } = await loadKinematicEvidence(root, sourcePath), citation = evidence.citation;
  const output = resolve(root, evidence.figure.cachePath);
  try { await readFile(output); return { path: output }; } catch { /* Restore a missing prepared input. */ }
  const response = await fetch(citation.sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source archive HTTP ${response.status}.`);
  const archive = new Uint8Array(await response.arrayBuffer());
  const tar = gunzipSync(archive, { maxOutputLength: 16777216 }); let eps: Buffer | null = null;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, '');
    if (!name) break;
    const size = Number.parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, '').trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid source tar member.');
    if (name === citation.member) { eps = tar.subarray(offset + 512, offset + 512 + size); break; }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!eps) throw new Error(`Source archive ${citation.sourceUrl} has no member ${citation.member}.`);
  const jpeg = extractJpegFromEps(eps.toString());
  await mkdir(dirname(output), { recursive: true });
  await writeFile(resolve(dirname(output), 'meaburn2005-source.tar.gz'), archive);
  await writeFile(output, jpeg);
  return { path: output };
}
