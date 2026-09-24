import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sha256, sha256File } from './index.js';

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

it('sha256 gives the same hex digest for text (UTF-8) and its bytes', () => {
  expect(sha256('abc')).toBe(ABC);
  expect(sha256(new TextEncoder().encode('abc'))).toBe(ABC);
  expect(sha256(Buffer.from('é'))).toBe(sha256('é'));
});

it('sha256File streams a file to the same digest and counts its bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'core-hash-'));
  try {
    const path = join(directory, 'abc.txt');
    await writeFile(path, 'abc');
    expect(await sha256File(path)).toEqual({ sha256: ABC, bytes: 3 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
