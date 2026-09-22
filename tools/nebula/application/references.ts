/** Local copies retain historical research JSON pins without making application replay load lab models. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pinned, type Pin } from '@cssearth/volume-bake/compact-inputs/io';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export async function verifyReplayReferences(root: string, directory: string, references: readonly Pin[]) {
  const needsCopies = references.some(pin => pin.path.startsWith('labs/'));
  let copies: {originalPath: string; path: string; sha256: string}[] = [];
  if (needsCopies) {
    const value: unknown = JSON.parse(await readFile(resolve(directory,'source/replay-references.json'),'utf8'));
    assert.ok(record(value) && value.schema === 'cssearth-replay-references@1' && Array.isArray(value.references));
    copies = value.references.map((row: unknown) => {
      assert.ok(record(row) && typeof row.originalPath === 'string' && typeof row.path === 'string' && typeof row.sha256 === 'string');
      assert.match(row.sha256, /^[a-f0-9]{64}$/);
      return {originalPath:row.originalPath,path:row.path,sha256:row.sha256};
    });
    assert.equal(new Set(copies.map(row=>row.originalPath)).size,copies.length);
  }
  for (const reference of references) {
    if (!reference.path.startsWith('labs/')) { await pinned(root,reference); continue; }
    const copy = copies.find(row=>row.originalPath === reference.path);
    assert.ok(copy,`Missing retained reference: ${reference.path}`);
    await pinned(directory,copy);
  }
}
