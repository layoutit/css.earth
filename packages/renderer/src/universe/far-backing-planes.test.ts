import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDatasetBillboards } from '@cssearth/objects';
import { drawsFromAfar } from './far-backing-planes.js';

const plan = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@2', imagePx: 256, banks: [
  { id: 'helix-layers', contextVisibility: 'galactic', attached: false, backing: true, host: 'helix', hostDefault: true },
  { id: 'helix-volume', contextVisibility: 'independent', attached: false, framingRadiusUnits: 1, backing: true, host: 'helix' },
  { id: 'm42-volume', contextVisibility: 'independent', attached: false, framingRadiusUnits: 1, backing: true }] });

test('a body with several banks is drawn from afar by one of them: its selected bank, or its default one', () => {
  const drawing = (detailed?: string) => ['helix-layers', 'helix-volume', 'm42-volume'].filter(id => drawsFromAfar(plan, id, detailed));
  assert.deepEqual(drawing(), ['helix-layers', 'm42-volume'], 'with none of its banks selected, the default one');
  assert.deepEqual(drawing('helix-layers'), ['helix-layers', 'm42-volume']);
  // On the Helix's page its volume's billboard covered its layered model (2026-10-07).
  assert.deepEqual(drawing('helix-volume'), ['helix-volume', 'm42-volume'], 'the selected bank, and not the default one over it');
  assert.deepEqual(drawing('m42-volume'), ['helix-layers', 'm42-volume'], 'another body\'s selection leaves it to its default bank');
});
