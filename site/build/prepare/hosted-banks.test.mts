import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { hostedBankRecords, readHostedContextBanks } from './prepare-catalog.mts';
const test = sourceTest();

const write = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value)); };

test('a bank drawn only for the bodies that hold it names its carriers; a bank drawn from any page names none', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-hosted-banks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bank = (id: string, type: string, properties: Record<string, unknown>) => ({ schema: 'cssearth-object@2', id, type, properties });
  const descriptors = new Map<string, unknown>([
    ['planet-dots', bank('planet-dots', 'catalogue-point-bank', { host: 'planet', preparation: { source: 'source/points.json' } })],
    ['star-disc', bank('star-disc', 'volume-dataset-bank', { preparation: { source: 'source/delivery.json' } })],
    ['free-nebula', bank('free-nebula', 'volume-dataset-bank', { host: 'nebula', preparation: { source: 'source/delivery.json' } })],
    ['galaxy-layers', bank('galaxy-layers', 'image-layer-bank', { host: 'galaxy' })],
  ]);
  await write(resolve(root, 'src/objects/star-disc/source/delivery.json'), { schema: 'cssearth-nebula-delivery@2', attachedTo: 'star' });
  await write(resolve(root, 'src/objects/free-nebula/source/delivery.json'), { schema: 'cssearth-nebula-delivery@2' });
  const contexts = [...descriptors].map(([id, descriptor]) => ({ id, type: (descriptor as { type: string }).type }));
  const hosted = await readHostedContextBanks(contexts, descriptors, [['star-companion', 'star-disc'], ['galaxy', 'galaxy-layers']], root);
  assert.deepEqual(hosted, { 'planet-dots': ['planet'], 'star-disc': ['star', 'star-companion'] },
    'dots go with their host; an attached cloud with its body and the datasets that show it; a free nebula and image layers stay in the code');
  const records = hostedBankRecords(hosted, descriptors, { '../src/objects/planet-dots/prepared/dots.bin': '/dots.bin', '../src/objects/galaxy-layers/prepared/a.webp': '/a.webp' });
  assert.deepEqual(records['planet-dots'], { carriers: ['planet'], descriptor: descriptors.get('planet-dots'), files: { '../src/objects/planet-dots/prepared/dots.bin': '/dots.bin' } });
  assert.equal('files' in records['star-disc']!, false, 'a cloud names its files in its own list');
  descriptors.set('lost-dots', bank('lost-dots', 'catalogue-point-bank', {}));
  await assert.rejects(readHostedContextBanks([{ id: 'lost-dots', type: 'catalogue-point-bank' }], descriptors, [], root),
    /src\/objects\/lost-dots\/object\.json: a catalogue-point-bank names no host/);
});

test('the world hears of every entry read, those read before it listened first, before any reader goes on', async t => {
  const { onObjectEntry, readObjectEntry } = await import('../../directory/object-entries.mts');
  const fetched = t.mock.method(globalThis, 'fetch', async (url: string) => new Response(JSON.stringify({ id: url.split('/')[2] })));
  const heard: string[] = [];
  await readObjectEntry('early-object');
  const stop = onObjectEntry(id => { heard.push(id); });
  assert.deepEqual(heard, ['early-object'], 'an entry read before the world listened is replayed');
  const reading = readObjectEntry('late-object').then(entry => { heard.push('reader'); return entry; });
  assert.deepEqual(await reading, { id: 'late-object' });
  assert.deepEqual(heard, ['early-object', 'late-object', 'reader'], 'the world declares its banks before the reader mounts it');
  stop();
  assert.equal(fetched.mock.callCount(), 2);
});

test('an object entry carries the banks it holds and the dots of the body it orbits, which its object reads unchanged', async () => {
  const { GET } = await import('../../pages/objects/[id]/entry.json.ts');
  const { APPLICATION_WORLD_CONTEXT } = await import('../../world-context-plan.mts');
  const { objectFromEntry } = await import('../../object-directory.mts');
  const { OBJECT_ENTRY_IDS } = await import('../../server/object-entry.mts');
  const records: Record<string, { carriers: string[]; descriptor: { id: string; type: string; properties: { host?: string } } }> =
    (await import('../../prepared/prepared-hosted-banks.json', { with: { type: 'json' } })).default as never;
  const entryOf = async (id: string) => (await GET({ params: { id } } as never)).json() as Promise<Record<string, unknown>>;
  const carried = (entry: Record<string, unknown>) => ((entry.banks ?? []) as { descriptor: { id: string } }[]).map(bank => bank.descriptor.id);
  const navigable = new Set(OBJECT_ENTRY_IDS);
  const [id, record] = Object.entries(records).find(([, record]) => record.carriers.some(carrier => navigable.has(carrier)))!;
  const carrier = record.carriers.find(carrier => navigable.has(carrier))!;
  const entry = await entryOf(carrier);
  assert.ok(carried(entry).includes(id), `${carrier} carries ${id}`);
  assert.equal(objectFromEntry(entry).id, carrier, 'the directory reads the entry as before');
  const dots = Object.values(records).filter(record => record.descriptor.type === 'catalogue-point-bank');
  const orbiter = APPLICATION_WORLD_CONTEXT.bodies.find(body => navigable.has(body.id) && body.orbit && dots.some(bank => bank.descriptor.properties.host === body.orbit!.centerBodyId))!;
  const centre = orbiter.orbit!.centerBodyId, orbiting = carried(await entryOf(orbiter.id));
  for (const bank of dots.filter(bank => bank.descriptor.properties.host === centre)) {
    assert.ok(orbiting.includes(bank.descriptor.id), `${orbiter.id}, which orbits ${centre}, carries ${bank.descriptor.id}`);
  }
  const plain = OBJECT_ENTRY_IDS.find(objectId => !Object.values(records).some(bank => bank.carriers.includes(objectId))
    && !APPLICATION_WORLD_CONTEXT.bodies.some(body => body.id === objectId && body.orbit && dots.some(bank => bank.descriptor.properties.host === body.orbit!.centerBodyId)))!;
  assert.equal('banks' in await entryOf(plain), false, `${plain} carries no bank`);
});
