import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseGalaxyBacking } from './galaxy-backing.js';

const KPC_M = 3.0856775814913673e19;
const prepared = () => JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way/prepared/backing.json', import.meta.url), 'utf8')) as Record<string, unknown>;

test('the Milky Way backing dims its blurred outer disc close up while its rings about the centre step up to the bulge', () => {
  const backing = parseGalaxyBacking(prepared());
  expect(backing.nearFade?.nearOpacity, 'the outer disc goes entirely close up').toBe(0);
  expect(backing.nearFade?.fadeM.map(m => m / KPC_M)).toEqual([12, 1.5]);
  expect(backing.sections?.map(section => section.texturePath)).toEqual(['backing/middle.webp', 'backing/inner.webp', 'backing/bulge.webp']);
  // Stacked over the result below, the rings reach 45, 70 and 100 percent close up.
  const [middle, inner, bulge] = backing.sections!.map(section => section.nearOpacity);
  const middleShown = middle!, innerShown = inner! + (1 - inner!) * middleShown;
  expect(middleShown).toBeCloseTo(.45, 3); expect(innerShown).toBeCloseTo(.7, 3); expect(bulge).toBe(1);
});

test('a backing refuses a malformed near fade or section, naming the bank and the value', () => {
  const data = prepared();
  const sections = data.sections as Record<string, unknown>[];
  expect(() => parseGalaxyBacking({ ...data, nearFade: { nearOpacity: 1.5, fadeM: [2, 1] } })).toThrow('backing: backing nearFade needs a nearOpacity in [0, 1]');
  expect(() => parseGalaxyBacking({ ...data, nearFade: { nearOpacity: .5, fadeM: [1, 2] } })).toThrow('far above near');
  expect(() => parseGalaxyBacking({ ...data, sections: [{ ...sections[0], texturePath: '../x.webp' }] })).toThrow('backing: backing section 0 needs a texture path');
  expect(() => parseGalaxyBacking({ ...data, sections: 'rings' })).toThrow('backing: backing sections must be a list');
});
