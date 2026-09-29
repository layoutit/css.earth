/** Resolve locations recorded by byte-identical fixtures before they moved beside their tests. */
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';

const moved = [
  ['tests/fixtures/telescope-families/f04-europa-stis', 'packages/fits/src/node/fixtures/telescope-families/f04-europa-stis'],
  ['tests/fixtures/telescope-families/family-sources.json', 'packages/fits/src/node/fixtures/telescope-families/family-sources.json'],

  ['tests/fixtures/telescope-family-examples', 'packages/telescope-cli/src/families/fixtures/telescope-family-examples'],
  ['tests/fixtures/telescope-families', 'packages/telescope-cli/src/families/fixtures/telescope-families'],
  ['tests/fixtures/alma', 'packages/telescope-cli/src/archives/interferometry/fixtures/alma'],
  ['tests/fixtures/telescope-vo', 'packages/telescope-cli/src/vo/fixtures/telescope-vo'],
  ['tests/fixtures/telescope-opus', 'packages/telescope-cli/src/fixtures/telescope-opus'],
  ['tests/fixtures/telescope-papers', 'packages/telescope-cli/src/fixtures/telescope-papers'],
  ['tests/fixtures/fits/binary-table-columns.fits', 'packages/telescope-cli/src/fixtures/fits/binary-table-columns.fits'],
  ['tests/objects/observation/author-sky-bands.test.mts', 'packages/telescope-cli/src/sky/author-sky-bands.test.mts'],
  ['tests/objects/observation/sky-band-composite.test.mts', 'packages/telescope-cli/src/sky/sky-band-composite.test.mts'],
  ['tests/objects/observation/resolution-evidence.test.mts', 'packages/telescope-cli/src/resolution-evidence.test.mts'],
  ['tests/objects/units/spectral-units.oracle.test.mts', 'packages/telescope-cli/src/archives/interferometry/spectral-units.oracle.test.mts'],
] as const;

export function fixturePath(path: string): string {
  const recorded = relative(WORKSPACE, resolve(WORKSPACE, path));
  for (const [old, current] of moved) {
    if (recorded === old || recorded.startsWith(`${old}/`)) {
      const candidate = resolve(WORKSPACE, current + recorded.slice(old.length));
      // Some family fixtures belong to bake and are outside this move's scope.
      if (existsSync(candidate)) return candidate;
    }
  }
  return resolve(WORKSPACE, path);
}

export function fixtureMemberPath(descriptor: string, member: string): string {
  const current = relative(WORKSPACE, descriptor);
  const pair = moved.find(([, path]) => current.startsWith(`${path}/`));
  const recorded = pair ? pair[0] + current.slice(pair[1].length) : current;
  return fixturePath(resolve(WORKSPACE, recorded, '..', member));
}
