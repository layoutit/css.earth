import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { projectRoot } from '@cssearth/core/node';
import { OBJECT_TREE_ROOT } from '@cssearth/objects';
const scripts = requireRecord(requireRecord(JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'package.json'), 'utf8'))).scripts);
import { ADD_DATASETS_STEPS, PREPARATION_STEPS } from '@cssearth/bake/prepare-object';

/** A project root whose prepared world context holds `bodies` round the Sun, in the root object's two files the chain reads. */
async function worldRoot(bodies: readonly string[]): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-object-world-')), prepared = resolve(root, 'src/objects', OBJECT_TREE_ROOT, 'prepared');
  await mkdir(prepared, { recursive: true });
  await writeFile(resolve(prepared, 'world-index.json'), JSON.stringify({ order: bodies, files: [OBJECT_TREE_ROOT], rows: {} }));
  await writeFile(resolve(prepared, 'world.json'), JSON.stringify({ focus: { id: 'sun' } }));
  return root;
}

test('deploy generation and object authoring place the object with the same world-context command', async () => {
  assert.ok(scripts['prepare:world-context']);
  const world = PREPARATION_STEPS.find(step => step.name === 'world');
  assert.ok(world);
  assert.deepEqual(await world.commands(['sun']), [['pnpm', 'prepare:world-context']]);
});

test('reuse-images preparation reaches the authored preparation only when asked', async () => {
  const prepare = PREPARATION_STEPS.find(step => step.name === 'prepare');
  assert.ok(prepare);
  assert.deepEqual(await prepare.commands(['earth']), [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write']]);
  assert.deepEqual(await prepare.commands(['earth'], { reuseImages: true }),
    [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write', '--reuse-images']]);
  assert.deepEqual(await prepare.commands(['earth'], { addDatasets: true }),
    [['node', 'site/build/prepare/authored/prepare-authored.ts', 'earth', '--write', '--reuse-images', '--add-datasets']]);
  // An add-datasets run keeps the chain's order and stops at the reader text: no world file, no billboard, no pin.
  assert.deepEqual(PREPARATION_STEPS.map(step => step.name).filter(name => ADD_DATASETS_STEPS.includes(name)), [...ADD_DATASETS_STEPS]);
});

test('several objects run each tool once: the id-list tools take every id, the authored preparation runs per object, the Sun and the world files are re-pinned last', async () => {
  const ids = ['hd-219134', 'hd-219134b'];
  const scopes = Object.fromEntries(PREPARATION_STEPS.map(step => [step.name, step.scope]));
  assert.deepEqual(scopes, { builds: 'once', inputs: 'ids', catalogue: 'once', geometry: 'once', prepare: 'each', discovery: 'once', sources: 'each', page: 'ids', audit: 'each', text: 'ids', markers: 'ids', placement: 'once', billboard: 'ids', world: 'once', systems: 'once', catalogues: 'once', pins: 'once' });
  assert.equal(PREPARATION_STEPS.find(step => step.name === 'prepare')?.parallel, true);
  for (const name of ['inputs', 'page', 'text', 'markers']) {
    const commands = await PREPARATION_STEPS.find(step => step.name === name)!.commands(ids);
    assert.equal(commands.length, 1, name); assert.deepEqual(commands[0]!.slice(-2), ids, name);
  }
  assert.deepEqual(await PREPARATION_STEPS.at(-1)!.commands(ids), [['node', 'site/build/prepare/authored/prepare-object-json.mts', 'sun'], ['node', 'site/build/prepare/world/pin-world-files.mts'], ['node', 'site/build/prepare/catalog/prepare-catalog.mts']]);
});

test('a site that does not know a new object stops the billboard step before any page is photographed', async () => {
  const { createServer } = await import('node:http'), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  const server = createServer((request, response) => { response.statusCode = request.url === '/' ? 200 : 404; response.end(); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(), previous = process.env.CSSEARTH_BILLBOARD_ORIGIN;
  process.env.CSSEARTH_BILLBOARD_ORIGIN = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  try { await assert.rejects(billboard.commands(['new-star']), /does not know new-star \(404 for \/new-star\/\).*Restart it/u); }
  finally { server.close(); if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('a body the world context does not hold is placed before its photograph, and one it holds keeps its one world pass', async () => {
  const order = PREPARATION_STEPS.map(step => step.name), placement = PREPARATION_STEPS.find(step => step.name === 'placement')!;
  assert.ok(order.indexOf('placement') > order.indexOf('markers') && order.indexOf('placement') < order.indexOf('billboard'));
  const root = await worldRoot(['hd-219134']), unprepared = await mkdtemp(resolve(tmpdir(), 'prepare-object-world-')), unreadable = await worldRoot(['hd-219134']);
  await writeFile(resolve(unreadable, 'src/objects', OBJECT_TREE_ROOT, 'prepared/world-index.json'), '{"order":');
  try {
    // A body in the index's order, the focus and an object with a file of bodies are all in the world already.
    for (const held of ['hd-219134', 'sun', OBJECT_TREE_ROOT]) assert.deepEqual(await placement.commands([held], { root }), [], held);
    assert.deepEqual(await placement.commands(['hd-219134', 'hd-219134b'], { root }), [['pnpm', 'prepare:world-context']]);
    // No world yet, or one whose index does not read: the pass that writes it runs.
    for (const without of [unprepared, unreadable]) assert.deepEqual(await placement.commands(['hd-219134'], { root: without }), [['pnpm', 'prepare:world-context']]);
  } finally { for (const made of [root, unprepared, unreadable]) await rm(made, { recursive: true }); }
});

test('a site that read its world before a new body was placed stops the billboard step before any page is photographed', async () => {
  const { createServer } = await import('node:http'), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  let named = false;
  const server = createServer((request, response) => {
    if (request.url === '/objects/new-star/entry.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(named ? { id: 'new-star', world: { files: ['milky-way'] } } : { id: 'new-star' })); }
    else if (request.url === '/objects/unknown-star/entry.json') { response.statusCode = 404; response.end(); }
    else response.end('<!doctype html>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(), previous = process.env.CSSEARTH_BILLBOARD_ORIGIN, root = await worldRoot(['new-star', 'unknown-star', 'odd-star']);
  process.env.CSSEARTH_BILLBOARD_ORIGIN = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  const photographed = ['packages/bake/cli/prepare-arrival-billboard.mts', 'site/build/prepare/catalog/prepare-catalog.mts'];
  try {
    await assert.rejects(billboard.commands(['new-star'], { root }), /read the world context before new-star was placed in it.*Restart it, then resume from the billboard step/u);
    // An object that is no world body has no world file to be named: its entry is not asked for one.
    assert.deepEqual((await billboard.commands([OBJECT_TREE_ROOT], { root })).map(command => command[1]), photographed);
    named = true;
    assert.deepEqual((await billboard.commands(['new-star'], { root })).map(command => command[1]), photographed);
    // A body the site has no entry for is unknown to it, even between two ids whose pages it serves.
    await assert.rejects(billboard.commands(['new-star', 'unknown-star', 'new-star-b'], { root }), /does not know unknown-star \(404 for \/objects\/unknown-star\/entry\.json\).*Restart it/u);
    // An entry that is not JSON says nothing of the world: the photograph is left to find what is wrong.
    assert.deepEqual((await billboard.commands(['odd-star'], { root })).map(command => command[1]), photographed);
  } finally { server.close(); await rm(root, { recursive: true }); if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('every baked body gets its arrival billboard before the world files read the catalogue, from a site that must answer', async () => {
  const order = PREPARATION_STEPS.map(step => step.name), billboard = PREPARATION_STEPS.find(step => step.name === 'billboard')!;
  assert.ok(order.indexOf('billboard') > order.indexOf('page') && order.indexOf('billboard') < order.indexOf('world'));
  assert.ok(order.indexOf('systems') > order.indexOf('world') && order.indexOf('systems') < order.indexOf('pins'), 'a system is read from the world, and the catalogue registers it');
  const previous = process.env.CSSEARTH_BILLBOARD_ORIGIN;
  process.env.CSSEARTH_BILLBOARD_ORIGIN = 'http://127.0.0.1:9';
  try { await assert.rejects(billboard.commands(['hd-219134']), /No site answers at http:\/\/127\.0\.0\.1:9: start it with pnpm dev/u); }
  finally { if (previous === undefined) delete process.env.CSSEARTH_BILLBOARD_ORIGIN; else process.env.CSSEARTH_BILLBOARD_ORIGIN = previous; }
});

test('the reader text budgets and the Sun the later steps build on are checked before the bake, not after it', () => {
  const order = PREPARATION_STEPS.map(step => step.name);
  assert.ok(order.indexOf('inputs') < order.indexOf('prepare') && order.indexOf('inputs') > order.indexOf('builds'));
});
