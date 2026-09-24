import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createSceneSessions } from '../scene/scene-session.mts';
import { createDatasetEffects } from '../scene/scene-datasets.mts';

type World = NonNullable<ReturnType<Parameters<typeof createDatasetEffects>[1]>>;

test('a lens that shows a volume waits for a world that has not loaded yet, then shows it', async () => {
  const session = createSceneSessions().start({ objectId: 'beta-pictoris', onFailure() {}, onCleanupError(error: unknown) { throw error; } });
  const calls: string[] = [];
  const bank = { objectId: 'beta-pictoris-disc', framingRadiusM: () => 1, selectLens() {}, subscribe: () => () => {},
    load: async () => { calls.push('load'); }, state: () => ({ lenses: [{ id: 'visible' }] }) };
  const world = { focusBank: (id: string) => id === bank.objectId ? bank : null,
    selectVolumeLens: (id: string, lens: string) => { calls.push(`select ${id} ${lens}`); },
    setVolumeLensEnabled: (id: string, enabled: boolean) => { calls.push(`enable ${id} ${enabled}`); } } as unknown as World;
  // A cold page mounts its body first: the world arrives only when asked for.
  let current: World | null = null;
  const effects = createDatasetEffects(session, () => current, async () => { calls.push('ensure world'); current = world; return world; });
  const volume = { objectId: 'beta-pictoris-disc', lensId: 'visible', surface: 'color' };
  await effects.prepare(volume as never, new AbortController().signal);
  effects.commit(volume as never);
  assert.deepEqual(calls, ['ensure world', 'load', 'select beta-pictoris-disc visible', 'enable beta-pictoris-disc true']);
});
