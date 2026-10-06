import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeOrbitFades, contextEmphasis, contextSubject, inSubjectFamily, namedBesideSubject, otherSystemsOpacity, outsideFamilyOrbitOpacity,
  pathOpacity } from './context-presentation-policy.js';

const saturn = { id: 'saturn', centreId: 'sun' }, titan = { id: 'titan', centreId: 'saturn' }, jupiter = { id: 'jupiter', centreId: 'sun' };
const sun = { id: 'sun', centreId: undefined }, isStar = (id: string) => id === 'sun';
const page = (body: { id: string; centreId: string | undefined }) => contextSubject(body, undefined, undefined, false, false, isStar);
const fades = { context: .8, own: .5 }, dim = .25;

test('a frame has one subject, and a satellite shares its host\'s family', () => {
  assert.deepEqual(page(saturn), { kind: 'body', id: 'saturn', focusId: 'saturn', hostId: 'saturn', hostIsStar: false,
    families: new Set(['saturn']), page: true, held: false, quietMinors: true });
  assert.deepEqual(page(titan), { kind: 'body', id: 'titan', focusId: 'titan', hostId: 'saturn', hostIsStar: false,
    families: new Set(['saturn']), page: true, held: false, quietMinors: true });
  assert.deepEqual(page(sun), { kind: 'body', id: 'sun', focusId: 'sun', hostId: 'sun', hostIsStar: true,
    families: new Set(['sun']), page: true, held: false, quietMinors: false });
  // A moons view holds its host as the subject; an overview has no subject but keeps the family it was opened from.
  const moons = contextSubject(saturn, undefined, undefined, true, true, isStar), overview = contextSubject(saturn, undefined, undefined, true, false, isStar);
  assert.deepEqual([moons.kind, moons.id, moons.held, moons.page, moons.quietMinors], ['system', 'saturn', true, false, false]);
  assert.deepEqual([overview.kind, overview.id, overview.hostId, [...overview.families]], ['none', null, 'saturn', ['saturn']]);
  // A flight previews its destination and keeps the selected body's family until it lands; a flight to an overview has no subject.
  const flight = contextSubject(titan, jupiter, 'jupiter', false, false, isStar), leaving = contextSubject(saturn, undefined, null, false, false, isStar);
  assert.deepEqual([flight.kind, flight.id, flight.focusId, flight.hostId, [...flight.families], flight.page], ['body', 'jupiter', 'jupiter', 'jupiter', ['saturn', 'jupiter'], false]);
  assert.deepEqual([leaving.kind, leaving.id, leaving.focusId, leaving.page], ['body', null, 'saturn', true]);
});

test('a body is in the family when it circles the family\'s host', () => {
  for (const subject of [page(saturn), page(titan)]) {
    assert.equal(inSubjectFamily(subject, 'saturn'), true);
    assert.equal(inSubjectFamily(subject, 'sun'), false);
    assert.equal(inSubjectFamily(subject, 'jupiter'), false);
    assert.equal(inSubjectFamily(subject, undefined), false);
  }
});

test('one rule gives every path its opacity', () => {
  const host = page(saturn), moons = contextSubject(saturn, undefined, undefined, true, true, isStar), overview = contextSubject(saturn, undefined, undefined, true, false, isStar);
  const path = (subject: typeof host, o: { family?: boolean; emphasised?: boolean; fadesWithFocus?: boolean; flagged?: boolean }) =>
    pathOpacity(subject, o.family ?? false, o.emphasised ?? false, o.fadesWithFocus ?? false, o.flagged ?? false, fades, dim);
  // A body's own path on its page, and a moon's on its host's page, fade with the body's growth.
  assert.equal(path(host, { emphasised: true, fadesWithFocus: true }), .5);
  assert.equal(path(host, { family: true, fadesWithFocus: true }), .5);
  // The family's paths on a moon's page and in a moons view soften as context.
  for (const subject of [page(titan), moons]) assert.equal(path(subject, { family: true }), .8);
  // Outside the family a path is dim context, unless the reader points at it.
  assert.equal(path(host, {}), .8 * .5 * .25);
  assert.equal(path(host, { flagged: true }), .8);
  // A moons view keeps overview framing and dims the host's own path about its star too.
  assert.equal(path(moons, {}), .8 * .25);
  assert.equal(path(moons, { emphasised: true }), .8 * .25);
  // An overview frames every path as context; its dimming is absent because no host is passed (outsideFamilyOrbitOpacity).
  assert.equal(pathOpacity(overview, false, false, false, false, fades, 1), .8);
});

test('the close-up fades keep a floor for context and none for the focused body\'s own path', () => {
  const fade = { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 };
  assert.deepEqual(closeOrbitFades(fade, .05), { context: 1, own: 1 });
  assert.deepEqual(closeOrbitFades(fade, .5), { context: .3, own: 0 });
});

test('the dimming outside a family relaxes as the camera reaches the parent system', () => {
  const host = { positionM: [10, 0, 0], orbit: { centerPositionM: [0, 0, 0] } };
  const at = (distance: number) => outsideFamilyOrbitOpacity(host, () => distance);
  assert.deepEqual([at(1), at(5), at(20), at(100)], [.25, .25, 1, 1]);
  assert.ok(at(10) > .25 && at(10) < 1);
  assert.equal(outsideFamilyOrbitOpacity(undefined, () => 1), 1);
  assert.equal(outsideFamilyOrbitOpacity({ positionM: [0, 0, 0] }, () => 1), 1);
});

test('a moon is named inside the kept families, and beside a planet or a moon its star\'s minor bodies are not', () => {
  const host = page(saturn), overview = contextSubject(saturn, undefined, undefined, true, false, isStar);
  assert.equal(namedBesideSubject(host, 'saturn', false), true);
  for (const subject of [host, overview, page(sun)]) assert.equal(namedBesideSubject(subject, 'jupiter', false), false);
  assert.equal(namedBesideSubject(host, undefined, false), true);
  assert.equal(namedBesideSubject(host, undefined, true), false);
  for (const subject of [overview, page(sun)]) assert.equal(namedBesideSubject(subject, undefined, true), true);
});

test('a marker, its caption and its path share one emphasis, and a hovered body is never dimmed', () => {
  assert.equal(contextEmphasis(false, false, true, .3), 1);
  assert.equal(contextEmphasis(false, true, true, .3), .3);
  assert.equal(contextEmphasis(false, false, false, .3), .3);
  assert.equal(contextEmphasis(false, true, false, .5), .15);
  assert.equal(contextEmphasis(true, true, false, .3), 1);
  // Other systems read as not belonging inside the camera's own system, and come up with the star field.
  assert.deepEqual([otherSystemsOpacity(1, 0), otherSystemsOpacity(1, 1), otherSystemsOpacity(.4, 0)], [.3, 1, 1]);
});
