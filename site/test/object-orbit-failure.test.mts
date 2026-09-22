import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { required } from './navigation-test-values.mts';
import { materialOrbitFixture } from '../../src/platform/test/object-material-orbit-fixture.mts';

for (const id of ['mercury', 'venus', 'mars']) {
  for (const event of ['wheel', 'drag', 'resize', 'invalidate', 'refresh', 'setState', 'media-change']) {
    test(`${id} material failure through shared ${event} retires once and disables retained callbacks`, async () => {
      const f = materialOrbitFixture(id);
      try {
        const orbit = required(await f.create());
        const callback = required(f.event(event, orbit));
        f.fail = true;
        assert.doesNotThrow(callback);
        assert.equal(f.errors.length, 1);
        assert.ok(f.errors[0] instanceof Error);
        assert.match(f.errors[0].message, /material publication failed/);
        assert.equal(required(f.lifetime).disposed, true);
        assert.equal(f.owners.size, 0);
        assert.equal(f.stage.listenerCount(), 0);
        assert.equal(required(f.resources).stats().images.entries.length, 0);
        const writes = f.writes;
        f.fail = false;
        callback(); orbit.refresh(); orbit.setState({ zoom: 3 });
        assert.equal(f.writes, writes);
        assert.equal(f.errors.length, 1);
      } finally { f.restore(); }
    });
  }
  test(`${id} initial material failure stops construction before live error reporting`, async () => {
    const f = materialOrbitFixture(id);
    try {
      f.fail = true;
      await assert.rejects(f.create, /material publication failed/);
      assert.deepEqual(f.errors, []);
      assert.equal(f.owners.size, 0);
      assert.equal(f.stage.listenerCount(), 0);
    } finally { f.restore(); }
  });
}
