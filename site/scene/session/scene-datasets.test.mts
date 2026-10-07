import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { createSceneSessions } from './scene-session.mts';
import { createDatasetEffects, sceneDatasetVolume } from './scene-datasets.mts';

type World = NonNullable<ReturnType<Parameters<typeof createDatasetEffects>[1]>>;

test('a dataset that shows a volume waits for a world that has not loaded yet, then shows it', async () => {
  const session = createSceneSessions().start({ objectId: 'beta-pictoris', onFailure() {}, onCleanupError(error: unknown) { throw error; } });
  const calls: string[] = [];
  const bank = { objectId: 'beta-pictoris-disc', framingRadiusM: () => 1, selectDataset() {}, subscribe: () => () => {},
    load: async () => { calls.push('load'); }, state: () => ({ datasets: [{ id: 'visible' }] }) };
  const world = { focusBank: (id: string) => id === bank.objectId ? bank : null,
    selectVolumeDataset: (id: string, dataset: string) => { calls.push(`select ${id} ${dataset}`); },
    setVolumeDatasetEnabled: (id: string, enabled: boolean) => { calls.push(`enable ${id} ${enabled}`); } } as unknown as World;
  // A cold page mounts its body first: the world arrives only when asked for.
  let current: World | null = null;
  const effects = createDatasetEffects(session, () => current, async () => { calls.push('ensure world'); current = world; return world; });
  const volume = { objectId: 'beta-pictoris-disc', datasetId: 'visible', surface: 'color' };
  await effects.prepare(volume as never, new AbortController().signal);
  effects.commit(volume as never);
  assert.deepEqual(calls, ['ensure world', 'load', 'select beta-pictoris-disc visible', 'enable beta-pictoris-disc true']);
});

test('the bank a session will show on arrival is its link\'s dataset\'s, or its default dataset\'s', () => {
  const volumes: Record<string, { objectId: string; datasetId: string; surface: string }> = {
    optical: { objectId: 'm42-volume', datasetId: 'optical', surface: 'optical' }, layers: { objectId: 'm42-layers', datasetId: 'layers', surface: 'layers' } };
  const mount = { datasets: { ids: ['optical', 'layers', 'plain'], defaultId: 'optical', volumeOf: (id: string) => volumes[id] ?? null } };
  const bank = (url: string | undefined, datasets: unknown = mount) => sceneDatasetVolume({ objectId: 'm42', url, mount: datasets } as never)?.objectId ?? null;
  assert.equal(bank('https://css.earth/m42/'), 'm42-volume');
  assert.equal(bank(undefined), 'm42-volume');
  assert.equal(bank('https://css.earth/m42/?dataset=layers'), 'm42-layers');
  // A dataset that shows no bank expects none.
  assert.equal(bank('https://css.earth/m42/?dataset=plain'), null);
  // A link the selection will refuse falls back to the default dataset, as the selection does.
  assert.equal(bank('https://css.earth/m42/?dataset=unknown'), 'm42-volume');
  assert.equal(bank('https://css.earth/m42/?dataset=a&dataset=b'), 'm42-volume');
  assert.equal(bank('https://css.earth/m42/', { datasets: undefined }), null);
});
