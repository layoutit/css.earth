import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { parseObjectDescriptor } from '@cssearth/objects';
import type { ObjectEntry } from './objects.mts';
import type { SceneFactory } from './browser/browser-types.mts';

const mount: SceneFactory = () => { throw new Error('This test only loads the mount function.'); };
let loaded: unknown;
let received: unknown[] = [];
mock.module(new URL('./scene-imports.mts', import.meta.url).href, { namedExports: { async importPackagedObjectRuntime() { return { async loadPackagedObject(...args: unknown[]) { received = args; return loaded; } }; } } });
let entry: ObjectEntry | null = null;
mock.module(new URL('./object-directory.mts', import.meta.url).href, { namedExports: { async loadObject() { return entry; } } });
const { objectAdapter } = await import('./object-adapter.mts');
const descriptor = parseObjectDescriptor({ schema: 'cssearth-object@2', id: 'body', type: 'layered-body', properties: {}, prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' } });

test('descriptor loading validates identity and forwards the signal to the packaged runtime', async () => {
  loaded = mount;
  const signal = new AbortController().signal;
  assert.equal(await objectAdapter.load('body', descriptor, undefined, signal), mount);
  assert.deepEqual(received, [descriptor, signal]);
  await assert.rejects(objectAdapter.load('other', descriptor), /Prepared descriptor does not match object other\./);
  loaded = {};
  await assert.rejects(objectAdapter.load('body', descriptor), /Object body scene loader must return a mount function\./);
});

test('explicit lists skip directory lookup and unknown ids or invalid loaders reject', async () => {
  entry = null;
  await assert.rejects(objectAdapter.load('missing', undefined, []), /Unknown cssEarth object: missing\./);
  await assert.rejects(objectAdapter.load('missing'), /Unknown cssEarth object: missing\./);
  const signal = new AbortController().signal;
  // The adapter reads only the id and scene loader of a directory entry.
  const object = { id: 'body', async loadScene(receivedSignal?: AbortSignal) { assert.equal(receivedSignal, signal); return mount; } } as ObjectEntry;
  assert.equal(await objectAdapter.load('body', undefined, [object], signal), mount);
  entry = object;
  assert.equal(await objectAdapter.load('body', undefined, undefined, signal), mount);
  const invalid = { id: 'body', async loadScene() { return null; } } as unknown as ObjectEntry;
  await assert.rejects(objectAdapter.load('body', undefined, [invalid]), /scene loader must return a mount function/);
  assert.deepEqual(objectAdapter.routes([{ route: '/b/' }, { route: '/a/' }, { route: '/c/' }]), ['/b/', '/a/', '/c/']);
  assert.equal(Object.isFrozen(objectAdapter), true);
});


test('explicit lists select the second matching identity while descriptors win over lists', async () => {
  const signal = new AbortController().signal;
  const listCalls: unknown[][] = [];
  const firstMount: SceneFactory = () => { throw new Error('Unused first mount.'); };
  const objects = [
    { id: 'other', async loadScene(...args: unknown[]) { listCalls.push(['other', ...args]); return firstMount; } },
    { id: 'body', async loadScene(...args: unknown[]) { listCalls.push(['body', ...args]); return mount; } },
  ] as ObjectEntry[];
  assert.equal(await objectAdapter.load('body', undefined, objects, signal), mount);
  assert.deepEqual(listCalls, [['body', signal]]);
  listCalls.length = 0;
  loaded = firstMount; received = [];
  assert.equal(await objectAdapter.load('body', descriptor, objects, signal), firstMount);
  assert.deepEqual(received, [descriptor, signal]);
  assert.deepEqual(listCalls, []);
});
