import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readHstProgram } from './calibrate.mts';
import { parsePsfSubtraction, psfSubtractionPath } from './psf-subtract.mts';

const read = async (id: string) => JSON.parse(await readFile(psfSubtractionPath(id), 'utf8')) as Record<string, unknown>;

test('every association a subtraction names is pinned in its program, through its band, on the star it says', async () => {
  const record = parsePsfSubtraction(await read('beta-pictoris-9987'));
  const { program } = await readHstProgram(record.program);
  const pinned = (observation: string) => {
    const entry = program.observations.find(other => other.observation === observation);
    assert.ok(entry, `${observation} is pinned in ${record.program}`);
    return entry;
  };
  for (const band of record.bands) {
    const pairs = [...band.science.map(roll => ({ ...roll, target: record.target })), { ...band.reference, target: record.reference }];
    for (const pair of pairs) {
      const long = pinned(pair.long), short = pinned(pair.short);
      for (const entry of [long, short]) {
        assert.equal(entry.opticalElement, band.band, `${entry.observation} is through ${band.band}`);
        assert.equal(entry.targetName, pair.target, `${entry.observation} is of ${pair.target}`);
        assert.equal(entry.aperture, long.aperture, `${entry.observation} is behind the same occulter`);
      }
      // The short frame replaces the long one where the long one saturates, so it must be the shorter.
      assert.ok(short.exposureEndMjd - short.exposureStartMjd < long.exposureEndMjd - long.exposureStartMjd, `${pair.short} is shorter than ${pair.long}`);
    }
  }
});

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
