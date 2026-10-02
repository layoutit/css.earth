import assert from 'node:assert/strict';
import { test } from 'node:test';
import { otherSpellingLines } from './check-color-spelling.mts';

const encode = (text: string) => new TextEncoder().encode(text);
// Built at run time, so this test file itself spells it only one way.
const other = 'colo' + 'ur', Other = 'Colo' + 'ur';

test('the other spelling is refused in prose, keys and identifiers, with its file and line', () => {
  assert.deepEqual(otherSpellingLines('src/objects/vega/text.json', encode(`{\n  "summary": "The ${other} of the star."\n}`)),
    [`src/objects/vega/text.json:2: "summary": "The ${other} of the star."`]);
  assert.equal(otherSpellingLines('packages/bake/src/a.ts', encode(`const whole${Other}Tie = 1;`)).length, 1);
  assert.equal(otherSpellingLines('docs/a.md', encode(`A FALSE-${other.toUpperCase()} MAP`)).length, 1);
});

test('a URL, the listed proper names, third-party files and binaries keep their own spelling', () => {
  assert.deepEqual(otherSpellingLines('src/sources/a.json', encode(`"url": "https://example.org/true-${other}/image.jpg"`)), []);
  assert.deepEqual(otherSpellingLines('src/objects/comet-1p/README.md', encode(`Giotto's Halley Multi${other} Camera took it.`)), []);
  assert.deepEqual(otherSpellingLines('pnpm-lock.yaml', encode(`${other}: 1.0.0`)), []);
  assert.deepEqual(otherSpellingLines('docs/a.png', new Uint8Array([0x89, 0, ...encode(other)])), []);
  // A kept name does not excuse the same word beside it.
  assert.equal(otherSpellingLines('docs/a.md', encode(`The Multi${other} Camera's ${other} filters`)).length, 1);
});
