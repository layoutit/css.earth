import assert from "node:assert/strict";
import test from "node:test";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { createLatestSelection } from "./latest-selection.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  const lifetime = createSceneLifetime(), busy = [], fatal = [], commits = [], discarded = [];
  const selection = createLatestSelection({ lifetime,
    onBusyChange: (value) => busy.push(value),
    onFatalError(error) { fatal.push(error); lifetime.destroy(); },
  });
  return { lifetime, busy, fatal, commits, discarded, selection,
    run(work, overrides = {}) { return selection.run({ prepare: () => work,
      commit: (value) => commits.push(value), discard: (value) => discarded.push(value), ...overrides }); } };
}

test("only the latest A/B/A request commits even when prepared work is shared", async () => {
  const h = harness(), a = deferred(), b = deferred();
  const first = h.run(a.promise), second = h.run(b.promise), third = h.run(a.promise);
  a.resolve("a"); b.resolve("b");
  assert.deepEqual(await Promise.all([first, second, third]), [false, false, true]);
  assert.deepEqual(h.commits, ["a"]);
  assert.equal(h.busy.at(-1), false);
});

test("superseded work that never began has no prepared value to discard", async () => {
  const h = harness();
  const first = h.run(null, { prepare() { assert.fail("Stale preparation must not start"); },
    discard() { assert.fail("Unstarted work owns no prepared resources"); } });
  const second = h.run(Promise.resolve("new"));
  assert.deepEqual(await Promise.all([first, second]), [false, true]);
});

test("stale rejection cannot roll back a newer request or clear its busy state", async () => {
  const h = harness(), a = deferred(), b = deferred();
  const rollbacks = [];
  const first = h.run(a.promise, { onCurrentFailure: () => rollbacks.push("old") });
  await Promise.resolve();
  const second = h.run(b.promise);
  a.reject(new Error("old failure"));
  assert.equal(await first, false);
  assert.deepEqual(rollbacks, []);
  assert.equal(h.busy.at(-1), true);
  b.resolve("winner");
  assert.equal(await second, true);
});

test("current failure rolls back synchronously, preserves committed state, and permits retry", async () => {
  const h = harness();
  let committed = { lens: "normal", rings: true };
  let desired = { ...committed, lens: "methane" };
  await assert.rejects(h.run(Promise.reject(new Error("decode")), {
    onCurrentFailure() { desired = committed; },
  }), /decode/);
  desired = { ...desired, rings: false };
  assert.equal(desired.lens, "normal");
  assert.equal(await h.run(Promise.resolve(desired), { commit(value) { committed = value; } }), true);
  assert.deepEqual(committed, { lens: "normal", rings: false });
});

test("disposal settles pending selection and late prepared resources are discarded", async () => {
  const h = harness(), gate = deferred();
  const pending = h.run(gate.promise);
  await Promise.resolve();
  h.lifetime.destroy();
  assert.equal(await pending, false);
  const busy = [...h.busy];
  gate.resolve("late resource");
  await new Promise(setImmediate);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.discarded, ["late resource"]);
  assert.deepEqual(h.busy, busy);
});

test("nested preparation can guard stale cache mutations with the same request identity", async () => {
  const h = harness(), gate = deferred(), mutations = [];
  const first = h.run(null, { async prepare({ isCurrent }) {
    await gate.promise;
    if (isCurrent()) mutations.push("old");
    return "old";
  } });
  await Promise.resolve();
  await h.run(Promise.resolve("new"));
  gate.resolve();
  assert.equal(await first, false);
  assert.deepEqual(mutations, []);
});

test("commit failure is fatal and cannot publish a successful busy or control state", async () => {
  const h = harness();
  await assert.rejects(h.run(Promise.resolve(1), { commit() { throw new Error("partial commit"); } }), /partial commit/);
  assert.equal(h.fatal.length, 1);
  assert.equal(h.lifetime.disposed, true);
  assert.deepEqual(h.busy, [true]);
});

test("failure rollback cannot clear a new request started by its callback", async () => {
  const h = harness(), gate = deferred();
  let replacement;
  await assert.rejects(h.run(Promise.reject(new Error("failed")), {
    onCurrentFailure() { replacement = h.run(gate.promise); },
  }));
  assert.equal(h.busy.at(-1), true);
  gate.resolve("replacement");
  assert.equal(await replacement, true);
});
