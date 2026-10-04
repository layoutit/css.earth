import assert from 'node:assert/strict';
import test from 'node:test';
import { requirePresentationEnvelope, PREPARED_PRESENTATION_SCHEMA, OBJECT_RUNTIME_SCHEMA,
  PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA } from '@cssearth/objects';

const sky = { schema: PREPARED_CUBIC_SKY_SCHEMA, standard: CUBIC_SKY_STANDARD_SCHEMA, model: 'prepared', qualification: 'source',
  runtimeRasterization: false, orientation: 'camera-rotation-only-no-translation-or-parallax',
  cameraPitchResponse: -1, cameraZoomResponse: 0, presentationPitchOffsetDegrees: 0, presentationYawOffsetDegrees: 0 };
const controls = { datasets: null, settings: null };
const plan = () => ({ schema: PREPARED_PRESENTATION_SCHEMA, camera: { sceneScale: 1, minimumZoom: 1, maximumZoom: 2 }, sky, sun: null });

test('authored admission preserves the minimal camera and exact envelope diagnostics', () => {
  assert.doesNotThrow(() => requirePresentationEnvelope(plan(), 'authored', controls));
  for (const [value, message] of [
    [{ ...plan(), camera: { sceneScale: 0, minimumZoom: 1, maximumZoom: 2 } }, 'camera plan is incomplete'],
    [{ ...plan(), camera: { sceneScale: '1', minimumZoom: '2', maximumZoom: '10' } }, 'camera plan is incomplete'],
    [{ ...plan(), schema: 'old' }, 'schema is incompatible'],
    [{ ...plan(), extra: true }, 'unsupported plan field extra'],
    [{ ...plan(), resourceOrder: 'old' }, 'unsupported resource order: old'],
  ] as const) assert.throws(() => requirePresentationEnvelope(value, 'authored', controls),
    { name: 'TypeError', message: `Prepared presentation: ${message}.` });
});

test('runtime admission preserves strict camera and identity diagnostics', () => {
  const runtime = { ...plan(), schema: OBJECT_RUNTIME_SCHEMA, id: 'probe', controls };
  assert.throws(() => requirePresentationEnvelope(runtime, 'runtime'),
    { name: 'TypeError', message: 'Prepared data: unsupported camera model.' });
  assert.throws(() => requirePresentationEnvelope({ ...runtime, id: 'BAD' }, 'runtime'),
    { name: 'TypeError', message: 'Prepared data: object identity is invalid.' });
});

test('authored JSON camera coercion retains lexical array/object comparisons and short-circuit diagnostics', () => {
  for (const [minimumZoom, maximumZoom] of [['2', ['10']], [['2'], ['10']]]) {
    assert.throws(() => requirePresentationEnvelope({ ...plan(), camera: { sceneScale: 1, minimumZoom, maximumZoom } }, 'authored', controls),
      { name: 'TypeError', message: 'Prepared presentation: camera plan is incomplete.' });
  }
  assert.throws(() => requirePresentationEnvelope({ ...plan(), camera: { sceneScale: 0, minimumZoom: 1, maximumZoom: { toString: 0 } } }, 'authored', controls),
    { name: 'TypeError', message: 'Prepared presentation: camera plan is incomplete.' });
});
