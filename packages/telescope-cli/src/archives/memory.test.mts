import assert from 'node:assert/strict';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { ARCHIVE_MEMORY_MS, FRESH_VARIABLE, recall } from './memory.mts';

test('the newest saved answer within a day is recalled, an older one or another kind of file is not, and --fresh recalls nothing', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'archive-memory-')), now = Date.now();
  const save = async (name: string, value: unknown, ageMs: number) => { await writeFile(resolve(directory, name), JSON.stringify(value)); const at = new Date(now - ageMs); await utimes(resolve(directory, name), at, at); };
  const pick = (value: unknown, name: string) => value && typeof value === 'object' && 'question' in value && value.question === 'q' ? name : undefined;
  try {
    assert.equal(await recall(resolve(directory, 'absent'), '.json', pick), undefined);
    await save('old.json', { question: 'q' }, ARCHIVE_MEMORY_MS + 60_000);
    assert.equal(await recall(directory, '.json', pick, now), undefined);
    await save('earlier.json', { question: 'q' }, 3_600_000); await save('later.json', { question: 'q' }, 60_000);
    await save('other.json', { question: 'another' }, 1_000); await save('later.facets', { question: 'q' }, 500); await save('broken.json', 'x', 100);
    await writeFile(resolve(directory, 'broken.json'), '{');
    assert.equal(await recall(directory, '.json', pick, now), 'later.json');
    process.env[FRESH_VARIABLE] = '1';
    assert.equal(await recall(directory, '.json', pick, now), undefined);
  } finally { delete process.env[FRESH_VARIABLE]; await rm(directory, { recursive: true, force: true }); }
});
