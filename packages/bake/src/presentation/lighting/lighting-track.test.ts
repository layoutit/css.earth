import { it } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSheetLighting } from './lighting-track.ts';
import { prepareMaterialTracks } from './prepare-materials.ts';
import type { SheetLighting } from '../types.ts';

const frameCount = 5, zs = Array.from({ length: frameCount }, (_, frame) => -Math.cos(Math.PI * frame / (frameCount - 1)));
const lighting: SheetLighting = { frameCount, defaultFrame: frameCount - 1,
  sheet: { url: '/scenes/test/lighting-sheet.webp', presentations: zs.map((lightViewZ, frameIndex) => ({ frameIndex, lightViewZ, backgroundPosition: `${-frameIndex * 10}px 0px`, backgroundSize: '50px 10px' })) },
  shadowless: { url: '/scenes/test/lighting-shadowless.webp', frameIndex: frameCount - 1, backgroundPosition: '0px 0px', backgroundSize: '10px 10px' } };

it('a sphere draws every phase from one sheet and loads only the flood-lit frame until shadows are on', () => {
  const sheet = prepareSheetLighting(lighting);
  assert.deepEqual(sheet.entries, [{ key: 'shadowless', url: '/scenes/test/lighting-shadowless.webp', pool: 'warm' }, { key: 'lighting', url: '/scenes/test/lighting-sheet.webp', pool: 'lighting' }]);
  assert.deepEqual(sheet.required, ['shadowless']);
  // A lane names the pool of its startup images, where the flood-lit frame belongs.
  assert.deepEqual(prepareSheetLighting(lighting, 'mounted').entries.map(entry => entry.pool), ['mounted', 'lighting']);
  assert.deepEqual(sheet.pool(sheet.entries), { id: 'lighting', capacity: 1, concurrency: 1, retention: 'selection', reuse: false, decoding: 'sync' });
  const [track] = prepareMaterialTracks({ sun: null, materials: [sheet.track(7)] });
  assert.deepEqual([track!.target, track!.defaultFrame, track!.banks.map(bank => bank.id), track!.frame.indices], [7, 4, ['sheet'], [0, 1, 2, 3, 4]]);
  // The page takes the frame whose light is nearest in view z: each threshold is halfway between two neighbours.
  assert.deepEqual(track!.frame.thresholds, zs.slice(1).map((z, index) => (z + zs[index]!) / 2));
  const [bank] = track!.banks;
  assert.deepEqual(bank!.frames.map(frame => [frame.resource, frame.frame, frame.prewarm]), zs.map((_, frame) => ['lighting', frame, []]));
  assert.deepEqual(bank!.fixed, { resource: 'shadowless', frame: 4, row: null, backgroundPosition: '0px 0px', backgroundSize: '10px 10px' });
  assert.deepEqual([sheet.selection(false).mode, sheet.selection(false).frameOverride, sheet.selection(true).mode, sheet.selection(true).frameOverride], ['fixed', 4, 'frames', null]);
  assert.throws(() => prepareSheetLighting({ ...lighting, frameCount: 6 }), /addresses 5 frames of 6/);
});
