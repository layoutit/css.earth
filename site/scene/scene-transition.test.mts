import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { prepareSceneReplacement } from './scene-transition.mts';

setFlagsFromString('--expose-gc');
const collect: unknown = runInNewContext('gc');

type Options = Parameters<typeof prepareSceneReplacement>[0];
type Flight = Parameters<Options['navigation']['prepare']>[0];

const world = { viewport: {}, present() {}, previewSelection() {} };
const getWorld = () => world as unknown as ReturnType<Options['getWorld']>;

/** Prepares a flight away from a mounted scene. Returns what the destination keeps of that flight for as long as it
 * is mounted, and a reference that tells whether the scene the flight left is still held. */
async function flyAway() {
  const mount = { navigation: undefined };
  const kept: Flight['presentWorld'][] = [];
  const request = { signal: new AbortController().signal, url: 'http://localhost/mars/', camera: { kind: 'frame' },
    subject: { objectId: 'mars' }, timing: { mark() {} }, own() {},
    lifetime: { wait: async <T,>(task: Promise<T>) => ({ cancelled: false, value: await task }) } };
  await prepareSceneReplacement({
    fromId: 'earth', source: { mount } as unknown as Options['source'], object: { id: 'mars' } as Options['object'],
    request: request as unknown as Options['request'],
    navigation: { prepare(flight: Flight) { kept.push(flight.presentWorld); return Promise.resolve({}); } } as unknown as Options['navigation'],
    requests: { advance() {}, owns: () => true } as unknown as Options['requests'],
    loadObject: () => Promise.resolve({} as Awaited<ReturnType<Options['loadObject']>>),
    contentTransport: { load: () => Promise.resolve({}), descriptor: () => Promise.resolve({}) } as unknown as Options['contentTransport'],
    reducedMotion: false, getWorld });
  return { kept, departed: new WeakRef(mount) };
}

test('what a flight hands its destination does not keep the scene it left', async () => {
  const { kept, departed } = await flyAway();
  await new Promise(resolve => setTimeout(resolve));
  assert.equal(typeof collect, 'function');
  if (typeof collect === 'function') collect();
  assert.equal(typeof kept[0], 'function', 'the destination keeps the world publisher');
  assert.equal(departed.deref(), undefined);
});
