import assert from 'node:assert/strict';
import test from 'node:test';
import { materialOrbitFixture } from '../../src/platform/test/object-material-orbit-fixture.mjs';

for (const id of ['mercury', 'venus', 'mars']) {
  for (const event of ['wheel', 'drag', 'resize', 'invalidate', 'refresh', 'setState', 'media-change']) {
    test(`${id} material failure through shared ${event} retires once and disables retained callbacks`, () => {
      const f = materialOrbitFixture(id);
      try {
        const orbit = f.create();
        const callback = f.event(event, orbit);
        f.fail = true;
        if (event === 'refresh' || event === 'setState') assert.throws(callback, /material publication failed/);
        else assert.doesNotThrow(callback);
        assert.equal(f.errors.length, 1);
        assert.match(f.errors[0].message, /material publication failed/);
        assert.equal(f.lifetime.disposed, true);
        assert.equal(f.owners.size, 0);
        assert.equal(f.stage.listenerCount(), 0);
        if (id !== 'venus') assert.equal(f.ready, null);
        const writes = f.writes;
        f.fail = false;
        callback(); orbit.refresh(); orbit.setState({ zoom: 3 });
        assert.equal(f.writes, writes);
        assert.equal(f.errors.length, 1);
      } finally { f.lifetime.destroy(); }
    });
  }
  test(`${id} initial material failure stops construction before live error reporting`, () => {
    const f = materialOrbitFixture(id);
    try {
      f.fail = true;
      assert.throws(f.create, /material publication failed/);
      assert.deepEqual(f.errors, []);
      assert.equal(f.owners.size, 0);
      assert.equal(f.stage.listenerCount(), 0);
    } finally { f.lifetime.destroy(); }
  });
}
