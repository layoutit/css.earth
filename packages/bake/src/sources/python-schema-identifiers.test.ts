import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARCHIVED_CAMERA_SCHEMA, OBJECT_TEXT_SCHEMA, SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';

test('unbuilt tooling and preserved Python use the objects source-manifest identifier', () => {
  const root = new URL('../../../../', import.meta.url);
  for (const [path, count] of [['.github/scripts/checks/check-body-references.mts', 1], ['packages/bake/authoring/distant-worlds/author.py', 2]] as const) {
    const source = readFileSync(new URL(path, root), 'utf8');
    const literals = [...source.matchAll(/(['"])(cssearth-authoritative-sources@[0-9]+)\1/gu)].map(match => match[2]);
    assert.equal(literals.length, count, `${path} must retain every manifest schema declaration/check`);
    for (const literal of literals) assert.equal(literal, SOURCE_MANIFEST_SCHEMA, path);
  }
});

test('preserved Python camera and text writers conform to the objects-owned schema identifiers', () => {
  const root = new URL('../../../../', import.meta.url);
  for (const [path, name, schema, count] of [
    ['packages/bake/cli/prepare-archived-camera.py', 'archived-camera', ARCHIVED_CAMERA_SCHEMA, 2],
    ['packages/bake/authoring/distant-worlds/author.py', 'object-text', OBJECT_TEXT_SCHEMA, 1],
  ] as const) {
    const source = readFileSync(new URL(path, root), 'utf8');
    const literals = [...source.matchAll(new RegExp(`(['"])(cssearth-${name}@[0-9]+)\\1`, 'gu'))].map(match => match[2]);
    assert.equal(literals.length, count, `${path} must retain its schema declarations`);
    for (const literal of literals) assert.equal(literal, schema, path);
  }
});
