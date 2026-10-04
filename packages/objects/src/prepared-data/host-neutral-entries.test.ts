import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { ARCHIVED_CAMERA_SCHEMA, parseMatrixArchivedCamera } from '@cssearth/objects/archived-camera';
import { ARCHIVED_CAMERA_SCHEMA as mainSchema } from '@cssearth/objects';

test('objects codec typechecking excludes DOM while retaining host encoding globals', () => {
  const config = readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8');
  const libs = /"lib"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1];
  assert.ok(libs);
  assert.doesNotMatch(libs, /DOM/u);
  const built = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');
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
