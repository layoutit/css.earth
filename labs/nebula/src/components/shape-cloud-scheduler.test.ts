import test from 'node:test';
import assert from 'node:assert/strict';
import { createShapeCloudScheduler, type PreviewClock, type PreviewTicket } from './shape-cloud-scheduler.js';

function harness() {
  let now = 0, sequence = 0;
  const timers = new Map<number, { at: number; run(): void }>();
  const clock: PreviewClock = { now: () => now, set(run, delay) { const id = ++sequence; timers.set(id, { at: now + delay, run }); return id; },
    clear(id) { if (typeof id === 'number') timers.delete(id); } };
  const jobs: { ticket: PreviewTicket<number>; finish(value: number): void; fail(reason: Error): void }[] = [];
  const accepted: { value: number; quality: string }[] = [], cancelled: number[] = [], errors: unknown[] = [];
  const queue = createShapeCloudScheduler<number, number>({ value: 0, key: String, clock,
    run(ticket) { return new Promise((finish, fail) => { jobs.push({ ticket, finish, fail }); }); },
    cancel(ticket) { cancelled.push(ticket.revision); }, accept(value, ticket) { accepted.push({ value, quality: ticket.quality }); }, error: reason => errors.push(reason),
  });
  function advance(ms: number) {
    now += ms;
    for (;;) { const next = [...timers.entries()].find(([, timer]) => timer.at <= now); if (!next) break; timers.delete(next[0]); next[1].run(); }
  }
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return { queue, jobs, accepted, cancelled, errors, advance, flush };
}
test('continuous drag displays bounded drafts and coalesces to latest while one job runs', async () => {
  const h = harness(); h.queue.seed(0, 'detailed'); h.queue.begin(); h.queue.edit(1);
  assert.equal(h.jobs.length, 1); assert.equal(h.jobs[0]!.ticket.quality, 'draft');
  h.queue.edit(2); h.advance(300); h.queue.edit(3);
  assert.equal(h.jobs.length, 1, 'An edit launched work in parallel.');
  h.jobs[0]!.finish(1); await h.flush();
  assert.deepEqual(h.accepted, [{ value: 1, quality: 'draft' }]);
  assert.equal(h.jobs.length, 2, 'Continuous drag was only debounced until release.');
  assert.equal(h.jobs[1]!.ticket.value, 3, 'Superseded intermediate settings were queued.');
  assert.deepEqual(h.cancelled, [], 'Each input must not cancel the active draft.');
  h.queue.edit(4); h.queue.settle(); h.jobs[1]!.finish(3); await h.flush();
  assert.equal(h.jobs[2]!.ticket.quality, 'detailed'); assert.equal(h.jobs[2]!.ticket.value, 4);
  h.jobs[2]!.finish(4); await h.flush();
  assert.deepEqual(h.accepted.at(-1), { value: 4, quality: 'detailed' });
  assert.equal(h.jobs.length, 3);
});
test('resuming input cancels one obsolete final and rejects its late result', async () => {
  const h = harness(); h.queue.start(); h.queue.begin(); h.queue.edit(1); h.queue.edit(2);
  assert.equal(h.cancelled.length, 1); h.jobs[0]!.finish(0); await h.flush();
  assert.deepEqual(h.accepted, []); assert.equal(h.jobs[1]!.ticket.value, 2);
  h.queue.settle(); h.jobs[1]!.finish(2); await h.flush(); h.jobs[2]!.finish(2); await h.flush();
  assert.deepEqual(h.accepted.at(-1), { value: 2, quality: 'detailed' });
});
test('keyboard idle refines, cached final does not bake, and disconnect never cancels server work', async () => {
  const h = harness(); h.queue.seed(0, 'detailed'); h.queue.start(); assert.equal(h.jobs.length, 0);
  h.queue.edit(1); h.jobs[0]!.finish(1); await h.flush();
  h.advance(649); assert.equal(h.jobs.length, 1); h.advance(1); assert.equal(h.jobs[1]!.ticket.quality, 'detailed');
  h.queue.dispose(); h.jobs[1]!.finish(1); await h.flush();
  assert.deepEqual(h.cancelled, []); assert.equal(h.accepted.length, 1);
});
test('failed processing stops automatic retries until a user retry or new edit', async () => {
  const h = harness(); h.queue.start(); h.jobs[0]!.fail(new Error('offline')); await h.flush(); h.advance(5000);
  assert.equal(h.jobs.length, 1); assert.equal(h.errors.length, 1);
  h.queue.retry(); assert.equal(h.jobs.length, 2);
});
