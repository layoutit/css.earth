import test from "node:test";
import assert from "node:assert/strict";
import { createDestinationClient } from "../renderers/css/dist/testing.js";

class WorkerDouble extends EventTarget {
  sent = []; terminated = false;
  postMessage(data) { this.sent.push(data); }
  terminate() { this.terminated = true; }
  reply(data) { this.dispatchEvent(new MessageEvent("message", { data })); }
}
function fixture() {
  const workers = [], controller = new AbortController();
  const client = createDestinationClient({ catalog: { count: 3 }, signal: controller.signal,
    workerFactory: () => { const worker = new WorkerDouble(); workers.push(worker); return worker; } });
  return { client, controller, workers };
}

test("worker is lazy and obsolete query replies cannot complete the replacement request", async () => {
  const { client, workers } = fixture(); assert.equal(workers.length, 0);
  const cancel = new AbortController(), first = client.search("old", 8, cancel.signal);
  const rejected = assert.rejects(first, { name: "AbortError" }); cancel.abort(); await rejected;
  const latest = client.search("new");
  assert.equal(workers.length, 1);
  const worker = workers[0]; assert.deepEqual(worker.sent.map(m => m.type), ["init", "search", "cancel", "search"]);
  worker.reply({ id: 1, value: [{ id: "stale" }] }); assert.equal(client.stats().pending, 1);
  worker.reply({ id: 2, value: [{ id: "latest" }], stats: { detailPacks: 0 } });
  assert.deepEqual(await latest, [{ id: "latest" }]); assert.equal(client.stats().pending, 0); client.dispose();
});

test("scene disposal terminates the worker, rejects all pending work and releases cache statistics", async () => {
  const { client, controller, workers } = fixture();
  const result = client.resolve("selected"), rejected = assert.rejects(result, /disposed/);
  controller.abort(); await rejected;
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(client.stats(), { worker: false, starts: 1, pending: 0, disposed: true, store: null });
  await assert.rejects(client.search("another"), /disposed/);
});

test("worker failure owns pending rejections and restarts only on explicit retry", async () => {
  const { client, workers } = fixture();
  const first = client.search("first"), failed = assert.rejects(first, /could not load/);
  workers[0].dispatchEvent(new Event("error")); await failed;
  assert.equal(workers[0].terminated, true); assert.equal(workers.length, 1);
  const retry = client.search("retry"); assert.equal(workers.length, 2);
  workers[1].reply({ id: 2, value: [] }); assert.deepEqual(await retry, []); client.dispose();
});

test("the client bounds outstanding requests and releases each reservation", async () => {
  const { client } = fixture();
  const results = Array.from({ length: 8 }, () => client.resolve("entity"));
  const rejected = results.map(promise => assert.rejects(promise, /disposed/));
  await assert.rejects(client.resolve("overflow"), /capacity/);
  client.dispose(); await Promise.all(rejected); assert.equal(client.stats().pending, 0);
});
