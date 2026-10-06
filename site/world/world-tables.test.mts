import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex, parsePreparedWorldSystem } from '@cssearth/objects';
import type { PreparedWorldContext } from '@cssearth/objects';
import { systemFramingTables } from './systems/system-framing.mts';
import { satelliteSystemIndex } from './systems/satellite-systems.mts';
import { annotationsForBodies, createWorldVisibilityPolicy } from './application/application-world-visibility.mts';
import { worldObjects } from './systems/world-objects.mts';
const test = sourceTest();

// What every page reads (the summary and the files drawn from anywhere), the Earth system's file, and one file a page reads
// later: TOI-178's system, a plain-dot star with its six planets.
const prepared = new URL('../../src/objects/observable-universe/prepared/', import.meta.url);
const json = async (name: string) => JSON.parse(await readFile(new URL(name, prepared), 'utf8')) as unknown;
const index = parsePreparedWorldIndex(await json('world-index.json'));
let summary: PreparedWorldContext = parsePreparedWorldContextSummary(await json('world.json'));
for (const id of index.files) {
  const file = await json(`../../${id}/prepared/members.json`) as { anywhere?: unknown };
  if (file.anywhere === true || id === 'earth-system') summary = extendWorldContext(summary, [parsePreparedWorldSystem(file, summary, id)]);
}
const host = 'toi-178', holder = `${host}-system`, system = parsePreparedWorldSystem(await json(`../../${holder}/prepared/members.json`), summary, holder);
const extended = extendWorldContext(summary, [system]);
assert.ok(!summary.bodies.some(body => body.id === host) && extended.bodies.some(body => body.id === host), `${host} arrives with its file`);

test('a star whose planets are in a file not read yet is no system host; its system\'s file brings its candidates and its radius', () => {
  const before = systemFramingTables(summary);
  assert.equal(before.viewHosts.has(host), false, 'the files a page starts with do not know the host');
  assert.equal(before.radii.get(host), undefined);
  const after = systemFramingTables(extended);
  assert.ok(after.viewHosts.has(host) && after.stellar.has(host), 'held, it has candidates and opens out of edge-on');
  assert.ok((after.radii.get(host) ?? 0) > 0, 'its planets give it a framing radius');
  for (const [id, radius] of before.radii) assert.equal(after.radii.get(id), radius, `${id} keeps its radius`);
  const hostRow = extended.bodies.find(body => body.id === host);
  assert.ok(hostRow?.systemView && !hostRow.orbit, 'the file holds the host as a placed star with a system view');
});

test('satellite families follow the plan they are read from', () => {
  const without = satelliteSystemIndex({ focus: summary.focus, bodies: summary.bodies.filter(body => body.classification !== 'satellite') });
  assert.equal(without.systems.length, 0);
  const index = satelliteSystemIndex(summary);
  assert.equal(index.byHost.get('earth')?.name, 'Earth–Moon system');
  assert.equal(index.byMember.get('moon'), index.byHost.get('earth'));
});

test('the visibility policy built over an extended plan holds the added bodies, with the annotations their rows give', () => {
  const before = createWorldVisibilityPolicy(worldObjects(summary), summary);
  assert.equal(before.systemMembers.has(`${host}b`), false);
  assert.equal(before.annotationPriorities[`${host}b`], undefined);
  const after = createWorldVisibilityPolicy(worldObjects(extended), extended);
  assert.ok(after.systemMembers.has(`${host}b`) && after.systemMembers.has(host), 'the planet and its star are system members');
  assert.ok(after.plainDotIds.includes(host), 'the host stays the plain dot its row says it is');
  assert.deepEqual([...after.placedSystemOf(`${host}b`)].sort(), [host, ...system.bodies.filter(body => body.id !== host).map(body => body.id)].sort());
  const annotations = annotationsForBodies(system.bodies);
  for (const body of system.bodies) {
    assert.equal(annotations.annotationPriorities[body.id], after.annotationPriorities[body.id], `${body.id} tier`);
    assert.deepEqual(annotations.annotationOpacities[body.id], after.annotationOpacities[body.id], `${body.id} strength`);
  }
  // The summary's own bodies keep their annotations: the first plan's tables stay valid once a system is added.
  for (const id of ['earth', 'jupiter', 'sirius']) {
    assert.equal(after.annotationPriorities[id], before.annotationPriorities[id], id);
  }
});

test('a selected star opens its whole system: the bodies that orbit it and the stars bound to it', async () => {
  // A system's file arrives when the camera nears it: 61 Cygni's (two stars), GJ 338's and TOI-421's (planets and a bound companion).
  let plan = summary;
  for (const id of ['gj-820-a-system', 'gj-338-a-system', 'toi-421-system']) plan = extendWorldContext(plan, [parsePreparedWorldSystem(await json(`../../${id}/prepared/members.json`), plan, id)]);
  const policy = createWorldVisibilityPolicy(worldObjects(plan), plan);
  assert.deepEqual([...policy.placedSystemOf('gj-820-a')].sort(), ['gj-820-a', 'gj-820-b']);
  assert.deepEqual([...policy.placedSystemOf('gj-338-b')].sort(), ['gj-338-a', 'gj-338-b'], 'a companion opens the system it is bound into');
  assert.deepEqual([...policy.placedSystemOf('toi-421')].sort(), ['bd-14-1137-b', 'toi-421', 'toi-421b', 'toi-421c']);
});
