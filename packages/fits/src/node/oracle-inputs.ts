import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
import type { OracleInputResolver } from '@cssearth/core/oracle';
const ORACLE_ROOT = projectRoot(typeof __filename === 'string' ? pathToFileURL(__filename) : import.meta.url);

export async function fitsArchiveInputs() {
  const record = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'packages/fits/src/node/fixtures/fits/archive-inputs.json'), 'utf8')));
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

export function fitsOracleInputResolvers(): OracleInputResolver[] {
  return [{ id: 'fits-fixtures', accepts: path => /^packages\/fits\/src\/node\/fixtures\/[A-Za-z0-9_/-]+\.(?:fits|json|sum|tab)$/u.test(path), verify: async () => {} },
    { id: 'fits-archive', accepts: path => path.startsWith('.local/fits-reference/'), verify: async input => {
      const pin = (await fitsArchiveInputs()).find(pin => pin.path === input.path);
      if (!pin || (input.bytes !== undefined && pin.bytes !== input.bytes)) throw new Error(`FITS test archive record changed: ${input.path}`);
    } }];
}
