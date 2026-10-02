import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { parseCompleteWorldContext, parsePreparedWorldContextSummary } from '@cssearth/objects';
const test = sourceTest();

const prepared = new URL('../../src/objects/sun/prepared/', import.meta.url);
const json = async (name: string) => JSON.parse(await readFile(new URL(name, prepared), 'utf8')) as unknown;

test('a plain-dot star nothing orbits is listed, holds no file, and its row is in the stars table', async () => {
  const summary = parsePreparedWorldContextSummary(await json('world-context-summary.json'));
  const stars = await json('world-stars.json') as Record<string, unknown>;
  const own = (summary.deferred ?? []).filter(body => body.host === body.id);
  assert.ok(own.length > 0);
  assert.deepEqual(Object.keys(stars).sort(), own.map(body => body.id).sort());
  for (const body of own) {
    assert.equal(body.plainDot, true, body.id);
    assert.equal(body.classification, 'star', body.id);
    await assert.rejects(access(new URL(`world-systems/${body.id}.json`, prepared)), `${body.id} has no system file`);
  }
  // No clickable body left the summary: every one it holds apart from those stars is still a body or a system's member.
  assert.ok(summary.bodies.every(body => !own.some(star => star.id === body.id)));
  const whole = await parseCompleteWorldContext(await json('world-context-summary.json'), id => json(`world-systems/${id}.json`), stars);
  assert.equal(whole.bodies.length, summary.worldBodyCount);
  // A reader that forgets the table is told which star it lacks.
  await assert.rejects(parseCompleteWorldContext(await json('world-context-summary.json'), id => json(`world-systems/${id}.json`)), /world-stars\.json holds none for it/u);
});
