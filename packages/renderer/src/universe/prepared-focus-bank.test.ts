import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImageFocusBank } from './prepared-focus-bank.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
/** The image bank's own selection, as the catalogue banks keep it: what it shows, and what it was asked to show. */
const kept = (first: string) => { const asked: string[] = []; let current = first; return { asked, current: () => current, select(dataset: string) { asked.push(dataset); current = dataset; } }; };

test("an image bank's datasets are its overlays', the first the default, and a pick is handed to the bank and told to its listeners", () => {
  const selection = kept('optical');
  const bank = createImageFocusBank('nebula', frame, async () => {}, ['optical', 'outer-ejecta'], selection);
  assert.deepEqual(bank.state()!.datasets.map(dataset => dataset.id), ['optical', 'outer-ejecta']);
  assert.deepEqual([bank.state()!.defaultDataset, bank.state()!.selectedDataset], ['optical', 'optical']);
  assert.throws(() => bank.selectDataset('infrared'), /Unknown image-layer dataset/u);
  assert.deepEqual(selection.asked, [], 'an unknown dataset changes nothing');
  let told = 0;
  const leave = bank.subscribe(() => { told++; });
  bank.selectDataset('outer-ejecta');
  assert.deepEqual([selection.asked, told, bank.state()!.selectedDataset, bank.state()!.defaultDataset], [['outer-ejecta'], 1, 'outer-ejecta', 'optical']);
  bank.selectDataset('outer-ejecta');
  assert.deepEqual([selection.asked.length, told], [1, 1], 'picking what is shown is no change');
  leave();
  bank.selectDataset('optical');
  assert.deepEqual([selection.asked, told], [['outer-ejecta', 'optical'], 1], 'a listener that left is not told');
});

test('a focus bank made again shows the dataset the bank shows, and follows a pick made through another', () => {
  const selection = kept('optical'), datasets = ['optical', 'outer-ejecta'];
  const first = createImageFocusBank('nebula', frame, async () => {}, datasets, selection);
  first.selectDataset('outer-ejecta');
  const again = createImageFocusBank('nebula', frame, async () => {}, datasets, selection);
  assert.equal(again.state()!.selectedDataset, 'outer-ejecta', 'asked for again, it reads the selection the bank keeps');
  again.selectDataset('optical');
  assert.equal(first.state()!.selectedDataset, 'optical', 'the earlier focus bank follows the bank, not its own last pick');
});

test('a bank without datasets has one, optical', () => {
  const bank = createImageFocusBank('galaxy', frame, async () => {});
  assert.deepEqual([bank.state()!.datasets.map(dataset => dataset.id), bank.state()!.selectedDataset], [['optical'], 'optical']);
  bank.selectDataset('optical');
  assert.throws(() => bank.selectDataset('outer-ejecta'), /Unknown image-layer dataset/u);
});
