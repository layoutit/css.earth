import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARCHIVED_CAMERA_SCHEMA, DISPLAY_ORIENTATION_SCHEMA, OBJECT_TEXT_SCHEMA, SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';

/** Quoted tokens shield # inside strings; comment tokens never contribute pins. */
function codeSchemaLiterals(source: string, name: string): string[] {
  const code = source.replace(/(['"])(?:\\.|(?!\1)[^\\\n])*?\1|#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu,
    token => token.startsWith('#') || token.startsWith('//') || token.startsWith('/*') ? '' : token);
  return [...code.matchAll(new RegExp(`(?:schema\\s*=|schema['"]?\\s*\\]|schema['"]?\\s*\\)|\\.schema)\\s*(?:=|!=|!==|===)?\\s*(['"])(cssearth-${name}@[0-9]+)\\1`, 'gu'))].map(match => match[2]!);
}

test('inline and standalone comments cannot replace a code schema pin', () => {
  assert.deepEqual(codeSchemaLiterals("dict(schema='cssearth-object-text@1')", 'object-text'), ['cssearth-object-text@1']);
  assert.deepEqual(codeSchemaLiterals("dict(schema='wrong') # schema='cssearth-object-text@1'", 'object-text'), []);
  assert.deepEqual(codeSchemaLiterals("# schema='cssearth-object-text@1'", 'object-text'), []);
});

test('unbuilt tooling and preserved Python use the objects source-manifest identifier', () => {
  const root = new URL('../../../../', import.meta.url);
  for (const [path, count] of [['.github/scripts/checks/check-body-references.mts', 1], ['packages/bake/authoring/distant-worlds/author.py', 2]] as const) {
    const source = readFileSync(new URL(path, root), 'utf8');
    const literals = codeSchemaLiterals(source, 'authoritative-sources');
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
    const literals = codeSchemaLiterals(source, name);
    assert.equal(literals.length, count, `${path} must retain its schema declarations`);
    for (const literal of literals) assert.equal(literal, schema, path);
  }
});

test('preserved Python display-orientation writer conforms to the objects-owned schema identifier', () => {
  const python = readFileSync(new URL('../../authoring/distant-worlds/author.py', import.meta.url), 'utf8');
  const literal = /write\(source\/'preparation\/rotation\.json',dict\(schema='([^']+)'/u.exec(python)?.[1];
  assert.equal(literal, DISPLAY_ORIENTATION_SCHEMA, 'author.py must write the rotation record with the shared display-orientation schema');
});
