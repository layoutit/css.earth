/** Numeric PNG byte expectations preserved from the independent step-one producer. */
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const root = new URL('./fixtures/galaxy-slice-replay/', import.meta.url);

export function galaxyGoldenBytes(): ReadonlyMap<string, Buffer> {
  const input: unknown = JSON.parse(readFileSync(new URL('png-bytes.json', root), 'utf8'));
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected golden byte records.');
  return new Map(Object.entries(input).map(([path, bytes]) => {
    if (!/^[xyz](?:\/(?:000|001)|-(?:reference|rgba8))\.png$/u.test(path)
      || !Array.isArray(bytes) || !bytes.length
      || !bytes.every((n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255)) {
      throw new TypeError('Invalid golden PNG bytes.');
    }
    return [path, Buffer.from(bytes)];
  }));
}

/** Materialize only in a test-owned temporary directory; no binary fixtures ship in git. */
export function writeGalaxyGolden(directory: string): void {
  mkdirSync(directory, {recursive: true});
  copyFileSync(new URL('prototype.json', root), resolve(directory, 'prototype.json'));
  for (const [path, bytes] of galaxyGoldenBytes()) {
    const destination = resolve(directory, path);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, bytes);
  }
}
