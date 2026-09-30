import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseGalaxyBacking } from './galaxy-backing.js';

const KPC_M = 3.0856775814913673e19;
const prepared = () => JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way/prepared/backing.json', import.meta.url), 'utf8')) as Record<string, unknown>;

test('the Milky Way backing dims its blurred outer disc close up while its rings about the centre step up to the bulge', () => {
  const backing = parseGalaxyBacking(prepared());
  assert.equal(backing.nearFade?.nearOpacity, 0, 'the outer disc goes entirely close up');
  assert.deepEqual(backing.nearFade?.fadeM.map(m => m / KPC_M), [12, 1.5]);
  assert.deepEqual(backing.sections?.map(section => section.texturePath), ['backing/middle.webp', 'backing/inner.webp', 'backing/bulge.webp']);
  // Stacked over the result below, the rings reach 45, 70 and 100 percent close up.
  const [middle, inner, bulge] = backing.sections!.map(section => section.nearOpacity);
  const middleShown = middle!, innerShown = inner! + (1 - inner!) * middleShown;
  assert.ok(Math.abs(middleShown - (.45)) < 10 ** -3 / 2, `${middleShown} is not close to ${.45}`); assert.ok(Math.abs(innerShown - (.7)) < 10 ** -3 / 2, `${innerShown} is not close to ${.7}`); assert.equal(bulge, 1);
});

test('a backing refuses a malformed near fade or section, naming the bank and the value', () => {
  const data = prepared();
  const sections = data.sections as Record<string, unknown>[];
  assert.throws(() => parseGalaxyBacking({ ...data, nearFade: { nearOpacity: 1.5, fadeM: [2, 1] } }), /backing: backing nearFade needs a nearOpacity in \[0, 1\]/);
  assert.throws(() => parseGalaxyBacking({ ...data, nearFade: { nearOpacity: .5, fadeM: [1, 2] } }), /far above near/);
  assert.throws(() => parseGalaxyBacking({ ...data, sections: [{ ...sections[0], texturePath: '../x.webp' }] }), /backing: backing section 0 needs a texture path/);
  assert.throws(() => parseGalaxyBacking({ ...data, sections: 'rings' }), /backing: backing sections must be a list/);
});
