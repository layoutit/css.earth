/** Test-only archive inputs, separate from production body acquisition. */
import { readFile } from 'node:fs/promises';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';

export async function fitsArchiveInputs() {
  const record = requireRecord(JSON.parse(await readFile(new URL('../../../tests/fixtures/fits/archive-inputs.json', import.meta.url), 'utf8')));
  if (record.schema !== 'cssearth-fits-reference-inputs@1') throw new Error('Invalid FITS reference input record.');
  const inputs = requireArray(record.inputs).map(raw => {
    const entry = requireRecord(raw), path = requireString(entry.path), url = requireString(entry.url);
    const bytes = requireFiniteNumber(entry.bytes);
    if (!/^\.local\/fits-reference\/[a-z0-9-]+\.fits$/u.test(path) || !/^https:\/\//u.test(url) ||
        !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 64 * 1024 * 1024)
      throw new Error('Invalid FITS reference input identity or size.');
    const headers = Object.fromEntries(Object.entries(requireRecord(entry.headers ?? {})).map(([key, value]) => [key, requireString(value)]));
    return { path, url, bytes, headers };
  });
  if (!inputs.length || inputs.length > 16 || new Set(inputs.map(i => i.path)).size !== inputs.length)
    throw new Error('Invalid FITS reference input population.');
  return inputs;
}
