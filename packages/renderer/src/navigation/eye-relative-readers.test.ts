import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** Nothing subtracts the camera's absolute position by hand. A double holds a kilometre at 157 parsecs, so a body 23 km wide
 * jumped by up to 13 px a frame while dragged (PSR J0437-4715, 2026-10-01). Readers go through the engine's fromEyeM,
 * eyeDistanceM or eyeAnchor, which keep the eye's exact offset from the body it is near. */
const root = resolve(import.meta.dirname, '../../../..');
const SUBTRACTIONS = [/pose\.positionM\[[^\]]+\]!? - /u, / - [\w.]*pose\.positionM\[/u, /pose\.positionM\.map\(\(\w+, \w+\) => \(?\w+ - /u];
// A world point made from the eye and a camera-space offset: not a difference of two world positions.
const ALLOWED = new Set(['site/world/systems/system-framing.mts: const focusPositionM = tuple(axis => from.pose.positionM[axis] - offset[axis]);']);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist', 'build', 'test'].includes(entry.name) ? [] : sources(path);
    return /\.m?ts$/u.test(entry.name) && !/\.test\.m?ts$/u.test(entry.name) ? [path] : [];
  });
}

/** Nor does anything ask whether two poses are the same place by `positionM` alone: at the pulsar a double steps every 790 m,
 * and 82 of 159 frames of a slow zoom kept `positionM` bit for bit while the eye moved (2026-10-02). sameEyePlace compares the
 * exact anchor too. */
const PLACE_EQUALITY = /pose\.positionM\.(every|some)\(\(\w+, \w+\) => \w+ [!=]== [\w.]*pose\.positionM\[/u;

it('no two poses are compared by positionM alone', () => {
  const found = [resolve(root, 'packages/renderer/src'), resolve(root, 'site')].flatMap(sources).flatMap(path =>
    readFileSync(path, 'utf8').split('\n').filter(line => PLACE_EQUALITY.test(line)).map(line => `${relative(root, path)}: ${line.trim()}`));
  assert.deepEqual(found, [], 'compare eye places with sameEyePlace from @cssearth/engine');
});

it('every reader of the camera position goes through the eye-relative helpers', () => {
  const found = [resolve(root, 'packages/renderer/src'), resolve(root, 'site')].flatMap(sources).flatMap(path =>
    readFileSync(path, 'utf8').split('\n').filter(line => SUBTRACTIONS.some(pattern => pattern.test(line))).map(line => `${relative(root, path)}: ${line.trim()}`))
    .filter(line => !ALLOWED.has(line));
  assert.deepEqual(found, [], 'use fromEyeM, eyeDistanceM or eyeAnchor from @cssearth/engine');
});
