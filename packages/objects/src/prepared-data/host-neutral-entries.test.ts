import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { ARCHIVED_CAMERA_SCHEMA, parseMatrixArchivedCamera } from '@cssearth/objects/archived-camera';
import { ARCHIVED_CAMERA_SCHEMA as mainSchema } from '@cssearth/objects';

function assertNoNodeGlobals(source: string): void {
  const file = ts.createSourceFile('index.js', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) assert.ok(!['Buffer', 'process', 'require', '__dirname'].includes(node.text), `Browser entry contains Node global ${node.text}`);
    ts.forEachChild(node, visit);
  };
  visit(file);
}

test('browser entry guard rejects every Node-global mutation while allowing diagnostic strings', () => {
  assertNoNodeGlobals('throw new Error("Intervals require a layer plan");');
  for (const name of ['Buffer', 'process', 'require', '__dirname']) assert.throws(() => assertNoNodeGlobals(`export const leaked = ${name};`), /Browser entry contains Node global/u);
});

test('objects codec typechecking excludes DOM while retaining host encoding globals', () => {
  const config = readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8');
  const libs = /"lib"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1];
  assert.ok(libs);
  assert.doesNotMatch(libs, /DOM/u);
  const built = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');
  assertNoNodeGlobals(built);
  assert.doesNotMatch(built, /(?:from\s*|import\s*\(|require\s*\()\s*['"]node:/u);
});
test('archived camera is a usable ESM/CJS entry with nonempty declarations', () => {
  assert.equal(ARCHIVED_CAMERA_SCHEMA, mainSchema);
  const required = createRequire(import.meta.url)('@cssearth/objects/archived-camera');
  assert.equal(required.ARCHIVED_CAMERA_SCHEMA, ARCHIVED_CAMERA_SCHEMA);
  const declaration = readFileSync(new URL('../../dist/archived-camera.d.ts', import.meta.url), 'utf8');
  assert.match(declaration, /SpiceCamera/u);
  assert.match(declaration, /ARCHIVED_CAMERA_SCHEMA/u);
  assert.throws(() => parseMatrixArchivedCamera({ schema: 'invalid', matrix: [], rayMatrix: [], positionKm: [], sunDirection: [] }), /Invalid archived source camera/u);
  const cameraSource = readFileSync(new URL('../../../spice/src/camera.ts', import.meta.url), 'utf8');
  assert.match(cameraSource, /from '@cssearth\/objects\/archived-camera'/u);
});
