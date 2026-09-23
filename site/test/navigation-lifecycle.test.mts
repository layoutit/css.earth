import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createNavigationLifecycle } from '../navigation-lifecycle.mts';

function harness() {
  const errors: unknown[] = [], cancelled: string[] = [], marks: string[] = [];
  const owner = createNavigationLifecycle({ onError: error => errors.push(error), onCancel: request => cancelled.push(request.id) });
  const begin = (id: string) => owner.begin({ id, url: `/${id}/`, subject: { kind: 'object' }, camera: { kind: 'preserve' },
    history: { history: 'push' }, scene: 'replace', origin: 'selection', feature: null,
    timing: { mark: phase => marks.push(`${id}:${phase}`) } });
  return { owner, begin, errors, cancelled, marks };
}

test('supersession revokes commit authority before abort and cleanup, including late resources', async () => {
  const h = harness(), first = h.begin('venus');
  const wait = first.lifetime.wait(new Promise<void>(() => {}));
  let released = 0, committed = 0;
  const staleCommit = () => assert.equal(h.owner.commit(first, () => committed++), false);
  first.signal.addEventListener('abort', staleCommit);
  first.own(() => { staleCommit(); released++; });
  first.own(() => { throw new Error('cleanup'); });
  h.owner.advance(first, 'flying');
  const second = h.begin('sun');
  assert.equal(first.phase, 'cancelled'); assert.equal(first.signal.aborted, true);
  assert.deepEqual(await wait, { cancelled: true });
  first.own(() => released++);
  assert.equal(h.owner.finish(first, 'finished'), false);
  assert.equal(h.owner.advance(first, 'committing'), false);
  assert.equal(h.owner.current, second); assert.equal(second.signal.aborted, false);
  assert.equal(committed, 0); assert.equal(released, 2); assert.equal(h.errors.length, 1);
  assert.deepEqual(h.cancelled, ['venus']); assert.deepEqual(h.marks, ['venus:cancelled']);
  h.owner.cancel();
});

test('arrival settles once without aborting the handed-off scene; failures abort', () => {
  const h = harness(), arrived = h.begin('venus');
  h.owner.advance(arrived, 'flying'); h.owner.advance(arrived, 'committing');
  assert.throws(() => h.owner.advance(arrived, 'flying'), /Invalid navigation transition/);
  assert.equal(h.owner.finish(arrived, 'finished'), true);
  h.owner.cancel();
  assert.equal(arrived.signal.aborted, false); assert.equal(arrived.phase, 'finished');
  assert.equal(h.owner.commit(arrived, () => assert.fail('late commit')), false);
  const failed = h.begin('sun'); let released = 0;
  failed.own(() => released++); h.owner.finish(failed, 'failed');
  assert.equal(failed.signal.aborted, true); assert.equal(released, 1);
  assert.deepEqual(h.marks, ['venus:finished', 'sun:failed']);
});
