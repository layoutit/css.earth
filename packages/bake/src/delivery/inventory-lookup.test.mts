import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { INVENTORY_SCHEMA, type AssetLocation, type Inventory } from '@cssearth/objects/node';
import { LOOKUP_ROWS, formatInventoryLookup, inventoryLookup, inventoryLookupOptions, type RuntimeAssetLocation } from '@cssearth/bake/delivery';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const asset = (location: AssetLocation, filename: string, bytes: number, content = filename): RuntimeAssetLocation => {
  const sha256 = digest(content), key = `runtime-assets/${sha256}/${filename}`;
  return { location, filename, bytes, sha256, id: 'fixture', key, url: `https://assets.example/${key}`, file: `/checkout/${location}/${filename}` };
};
const located = [asset('public', 'fixture-page-0.webp', 400), asset('public', 'fixture-page-1.webp', 600), asset('prepared', 'runtime.json', 90), asset('prepared', 'levels/Runtime-assets.json', 10)];
const inventory = (assets: readonly RuntimeAssetLocation[]): Inventory =>
  ({ schema: INVENTORY_SCHEMA, assets: assets.map(({ location, filename, bytes, sha256 }) => ({ location, filename, bytes, sha256 })) });

test('a search and a location narrow the listed files and their byte total, whatever the case of the text', () => {
  const options = inventoryLookupOptions(['fixture', '--search=RUNTIME', '--location=prepared']);
  const lookup = inventoryLookup('fixture', located, options);
  assert.deepEqual(lookup.files.map(file => file.filename), ['runtime.json', 'levels/Runtime-assets.json']);
  assert.deepEqual([lookup.total, lookup.bytes, lookup.since], [4, 100, undefined]);
  const text = formatInventoryLookup(lookup, options);
  assert.match(text, /^fixture: 2 of 4 files \(prepared, matching "RUNTIME"\), 100 bytes\n/u);
  assert.match(text, /prepared {11}90 {2}runtime\.json\n/u);
  assert.doesNotMatch(text, /https:/u);
  assert.match(formatInventoryLookup(inventoryLookup('fixture', located, {}), { urls: true, all: false }), /^fixture: 4 files, 1,100 bytes \(public 2, prepared 2\)\npublic .* fixture-page-0\.webp\n {4}https:\/\/assets\.example\/runtime-assets\//u);
});

test('a comparison names what was added, removed and changed since the earlier inventory', () => {
  const earlier = inventory([located[0], asset('public', 'fixture-page-1.webp', 500, 'older bytes'), asset('public', 'retired.webp', 70), located[2]]);
  const lookup = inventoryLookup('fixture', located, {}, earlier);
  assert.deepEqual(lookup.since?.added.map(file => file.filename), ['levels/Runtime-assets.json']);
  assert.deepEqual(lookup.since?.removed.map(file => file.filename), ['retired.webp']);
  assert.deepEqual(lookup.since?.changed.map(file => [file.filename, file.bytesBefore, file.bytes]), [['fixture-page-1.webp', 500, 600]]);
  assert.equal(lookup.since?.unchanged, 2);
  const text = formatInventoryLookup(lookup, { since: 'origin/main', urls: false, all: false });
  assert.match(text, /^fixture since origin\/main: 1 added \(\+10 bytes\), 1 removed \(-70 bytes\), 1 changed \(\+100 bytes\), 2 unchanged\n/u);
  assert.match(text, /\n\+ prepared {11}10 {2}levels\/Runtime-assets\.json\n- public {13}70 {2}retired\.webp\n~ public {6}500 → 600 {2}fixture-page-1\.webp\n$/u);
  // A revision that held no inventory makes every file an addition; the search still narrows both sides.
  assert.equal(inventoryLookup('fixture', located, { search: 'page' }, null).since?.added.length, 2);
  assert.equal(inventoryLookup('fixture', located, { search: 'page' }, earlier).since?.removed.length, 0);
});

test('long listings stop at the row limit unless every row is asked for, and an object without an inventory says so', () => {
  const many = Array.from({ length: LOOKUP_ROWS + 3 }, (_, index) => asset('public', `page-${index}.webp`, 1));
  const lookup = inventoryLookup('fixture', many, {});
  assert.match(formatInventoryLookup(lookup, { urls: false, all: false }), /\n… 3 more; narrow with --search or pass --all\n$/u);
  assert.equal(formatInventoryLookup(lookup, { urls: false, all: true }).trimEnd().split('\n').length, LOOKUP_ROWS + 4);
  assert.match(formatInventoryLookup(inventoryLookup('bare', null, {}), { urls: false, all: false }), /^bare: no inventory\.json/u);
});

test('options name at least one object and refuse unknown flags, locations and ids', () => {
  assert.deepEqual(inventoryLookupOptions(['mars', 'venus', 'mars', '--since=origin/main', '--json']).ids, ['mars', 'venus']);
  assert.throws(() => inventoryLookupOptions(['--search=runtime']), /at least one object id/u);
  assert.throws(() => inventoryLookupOptions(['mars', '--location=source']), /Choose a location from public, prepared/u);
  assert.throws(() => inventoryLookupOptions(['../mars']), /Not an object id/u);
  assert.throws(() => inventoryLookupOptions(['mars', '--serch=x']), /Unknown option/u);
});
