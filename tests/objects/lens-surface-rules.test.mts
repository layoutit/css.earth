import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { projectRoot } from './fixtures.mts';
import { requireArray, requireRecord, requireString } from '../../tools/sources/source-values.mts';

/**
 * A raster body paints its globe from hand-written CSS: one base rule for the default lens, and one
 * `[data-lens="<id>"]` override per other lens. The prepared runtime, the picker thumbnail and the
 * minimap all switch on their own, so a missing override is silent — the reader sees the default
 * lens's imagery under another lens's name. Venus shipped that way until it was measured in a
 * browser, so the rule set is checked here instead.
 */
const styleDirectory = resolve(projectRoot, 'src/renderers/css/styles');
const stylesheets = (await readdir(styleDirectory)).filter(name => name.endsWith('.css'));
const css = (await Promise.all(stylesheets.map(name => readFile(resolve(styleDirectory, name), 'utf8'))))
  .join('\n').replace(/\s+/gu, ' ');

/** Ids are lowercase, digits and hyphens, so they carry no regular-expression metacharacters. */
const plainId = (id: string) => { assert.match(id, /^[a-z0-9-]+$/u, `unexpected id ${id}`); return id; };
/** Bodies whose globe leaves take their image from an object-scoped surface rule. */
const surfaceBodies = [...css.matchAll(
  /\[data-object-id="([a-z0-9-]+)"\] \.polycss-scene s:not\(\.[a-z0-9-]+-polar\) \{ background-image/gu)]
  .map(match => match[1]);

test('every raster body paints its globe from a base surface rule', () => {
  assert.ok(surfaceBodies.length >= 20, `found ${surfaceBodies.length} bodies with a base surface rule`);
  assert.equal(new Set(surfaceBodies).size, surfaceBodies.length, 'a body declares its base surface rule once');
});

for (const id of [...new Set(surfaceBodies)].sort()) {
  test(`${id} gives every lens its own surface and pole images`, async () => {
    const content = requireRecord(JSON.parse(
      await readFile(resolve(projectRoot, 'src/objects', id, 'source/content/object.json'), 'utf8')));
    const lenses = requireRecord(content.lenses);
    const defaultLens = requireString(lenses.defaultLens);
    const declared = requireArray(lenses.controls).map(control => requireString(requireRecord(control).id));
    assert.ok(declared.includes(defaultLens), `${id}: the default lens is one of its controls`);
    const rule = (lens: string, polar: boolean) => new RegExp(
      `\\[data-object-id="${plainId(id)}"\\]\\[data-lens="${plainId(lens)}"\\] \\.polycss-scene ` +
      `s${polar ? `\\.${id}-polar` : `:not\\(\\.${id}-polar\\)`} \\{ background-image`, 'u');
    for (const lens of declared) {
      if (lens === defaultLens) continue;
      assert.match(css, rule(lens, false), `${id}/${lens}: no surface rule; the globe would keep ${defaultLens}'s imagery`);
      assert.match(css, rule(lens, true), `${id}/${lens}: no polar rule; the caps would keep ${defaultLens}'s imagery`);
    }
  });
}
