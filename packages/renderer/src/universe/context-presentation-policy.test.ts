import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeOrbitFades, contextEmphasis, contextSubject, namedBesideSubject, otherSystemsOpacity, outsideFamilyOrbitOpacity, pathOpacity,
  subjectRelation } from './context-presentation-policy.js';

const saturn = { id: 'saturn', role: 'planet', hostId: 'sun' } as const, titan = { id: 'titan', role: 'satellite', hostId: 'saturn' } as const;
const sun = { id: 'sun', role: 'star', hostId: undefined } as const;
const fades = { context: .8, own: .5 }, dim = .25;

test('a frame has one subject, and a satellite shares its host\'s family', () => {
  assert.deepEqual(contextSubject(saturn, false, false, undefined), { kind: 'body', id: 'saturn', hostId: 'saturn', hostIsSubject: true, hostIsStar: false });
  assert.deepEqual(contextSubject(titan, false, false, undefined), { kind: 'body', id: 'titan', hostId: 'saturn', hostIsSubject: false, hostIsStar: false });
  assert.deepEqual(contextSubject(sun, false, false, undefined), { kind: 'body', id: 'sun', hostId: 'sun', hostIsSubject: true, hostIsStar: true });
  assert.equal(contextSubject(saturn, true, true, undefined).kind, 'system');
  // An overview has no subject but keeps the family it was opened from; a flight previews a body or an overview.
  assert.deepEqual(contextSubject(saturn, true, false, undefined), { kind: 'none', id: null, hostId: 'saturn', hostIsSubject: true, hostIsStar: false });
  assert.equal(contextSubject(titan, true, false, 'titan').kind, 'body');
  assert.equal(contextSubject(saturn, false, false, null).kind, 'none');
});

test('a body is the subject, in its family, or outside it, by what it circles', () => {
  for (const focus of [saturn, titan]) {
    const subject = contextSubject(focus, false, false, undefined);
    assert.equal(subjectRelation(subject, focus.id, focus.hostId), 'subject');
    assert.equal(subjectRelation(subject, 'rhea', 'saturn'), 'family');
    assert.equal(subjectRelation(subject, 'jupiter', 'sun'), 'outside');
    assert.equal(subjectRelation(subject, 'io', 'jupiter'), 'outside');
  }
  // The host of a selected moon travels a path about the star: outside the family it hosts.
  assert.equal(subjectRelation(contextSubject(titan, false, false, undefined), 'saturn', 'sun'), 'outside');
  assert.equal(subjectRelation(contextSubject(saturn, true, false, undefined), 'saturn', 'sun'), 'outside');
});

test('one rule gives every path its opacity', () => {
  const page = contextSubject(saturn, false, false, undefined), moon = contextSubject(titan, false, false, undefined);
  const moons = contextSubject(saturn, true, true, undefined), overview = contextSubject(saturn, true, false, undefined), star = contextSubject(sun, false, false, undefined);
  // A body's own path fades with its growth; in a moons view the host's path is context.
  assert.equal(pathOpacity(page, 'subject', false, fades, dim), .5);
  assert.equal(pathOpacity(moons, 'subject', false, fades, dim), .8 * .5 * .25);
  // A host's page fades its moons' paths with it; a moon's page, a moons view and a star's page keep the family's.
  assert.equal(pathOpacity(page, 'family', false, fades, dim), .5);
  for (const subject of [moon, moons, star]) assert.equal(pathOpacity(subject, 'family', false, fades, dim), .8);
  // Outside the family a path is dim context, unless the reader points at it.
  for (const subject of [page, moon, moons]) {
    assert.equal(pathOpacity(subject, 'outside', false, fades, dim), .8 * .5 * .25);
    assert.equal(pathOpacity(subject, 'outside', true, fades, dim), .8);
  }
  assert.equal(pathOpacity(page, 'family', true, fades, dim), .8);
  for (const relation of ['family', 'outside'] as const) assert.equal(pathOpacity(overview, relation, false, fades, dim), .8);
});

test('the close-up fades keep a floor for context and none for the focused body\'s own path', () => {
  const fade = { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 };
  assert.deepEqual(closeOrbitFades(fade, .05), { context: 1, own: 1 });
  assert.deepEqual(closeOrbitFades(fade, .5), { context: .3, own: 0 });
});

test('the dimming outside a family relaxes as the camera reaches the parent system, and a moons view holds it', () => {
  const host = { positionM: [10, 0, 0], orbit: { centerPositionM: [0, 0, 0] } };
  const at = (distance: number, held = false) => outsideFamilyOrbitOpacity(host, () => distance, held);
  assert.deepEqual([at(1), at(5), at(20), at(100)], [.25, .25, 1, 1]);
  assert.ok(at(10) > .25 && at(10) < 1);
  assert.equal(at(100, true), .25);
  assert.equal(outsideFamilyOrbitOpacity(undefined, () => 1, false), 1);
  assert.equal(outsideFamilyOrbitOpacity({ positionM: [0, 0, 0] }, () => 1, false), 1);
});

test('a moon outside the family is unnamed, and beside a planet or a moon so are its star\'s minor bodies', () => {
  const page = contextSubject(saturn, false, false, undefined), overview = contextSubject(saturn, true, false, undefined), star = contextSubject(sun, false, false, undefined);
  assert.equal(namedBesideSubject(page, 'family', 'satellite', false), true);
  for (const subject of [page, overview, star]) assert.equal(namedBesideSubject(subject, 'outside', 'satellite', false), false);
  assert.equal(namedBesideSubject(page, 'outside', 'planet', false), true);
  assert.equal(namedBesideSubject(page, 'outside', 'planet', true), false);
  for (const subject of [overview, star]) assert.equal(namedBesideSubject(subject, 'outside', 'planet', true), true);
});

test('a marker, its caption and its path share one emphasis, and a hovered body is never dimmed', () => {
  assert.equal(contextEmphasis(false, false, true, .3), 1);
  assert.equal(contextEmphasis(false, true, true, .3), .3);
  assert.equal(contextEmphasis(false, false, false, .3), .3);
  assert.equal(contextEmphasis(false, true, false, .5), .15);
  assert.equal(contextEmphasis(true, true, false, .3), 1);
  // Other systems read as not belonging inside the focus star's system, and come up with the star field.
  assert.deepEqual([otherSystemsOpacity(1, 0), otherSystemsOpacity(1, 1), otherSystemsOpacity(.4, 0)], [.3, 1, 1]);
});
