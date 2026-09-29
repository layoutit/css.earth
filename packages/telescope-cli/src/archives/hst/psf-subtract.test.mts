import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePsfSubtraction, psfSubtractionPath } from './psf-subtract.mts';

const read = async (id: string) => JSON.parse(await readFile(psfSubtractionPath(id), 'utf8')) as Record<string, unknown>;

test('the reference is scaled by a cited flux ratio, and a missing or impossible ratio is refused', async () => {
  const raw = await read('beta-pictoris-9987');
  const bands = raw.bands as Record<string, unknown>[];
  const withBand = (fluxRatio: unknown) => ({ ...raw, bands: [{ ...bands[0], fluxRatio }, ...bands.slice(1)] });
  assert.throws(() => parsePsfSubtraction(withBand(undefined)), /flux ratio/u);
  assert.throws(() => parsePsfSubtraction(withBand({ referenceOverScience: 0, relativeUncertainty: 0.02 })), /positive/u);
  assert.throws(() => parsePsfSubtraction(withBand({ referenceOverScience: 1.6, relativeUncertainty: 1 })), /uncertainty/u);
  const { fluxRatioSource: _, ...uncited } = raw;
  assert.throws(() => parsePsfSubtraction(uncited));
});
