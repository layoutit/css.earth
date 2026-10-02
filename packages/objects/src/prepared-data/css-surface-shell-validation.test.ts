import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PreparedCssSurfaceShell } from './css-surface-shell-types.js';
import { validatePreparedCssSurfaceShell } from './css-surface-shell-validation.js';

function fixture(): PreparedCssSurfaceShell {
  return {
    schema: 'cssearth-css-surface-shell@1', id: 'fixture', unitScale: 37,
    frame: { referenceFrame: 'fixture-frame', epochJdTt: 123, originM: [120, 300, -70], localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      metersPerUnit: 10, boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } },
    atlas: { path: 'materials/rim.png', tileSize: 16, columns: 4, frames: 8 },
    visibility: { hiddenInsideM: 10, fullUntilM: 100, hiddenBeyondM: 200 },
    faces: [face('near', [0, 0, 1], [0, 0, 1], [0, 0, 1]), face('far', [0, 0, -1], [0, 0, -1], [0, 0, -1])],
    resources: [{ path: 'materials/rim.png', bytes: 100, width: 64, height: 32 }], provenance: {},
  };
}
function face(id: string, centerUnits: readonly [number, number, number], faceNormal: readonly [number, number, number], radialNormal: readonly [number, number, number]): PreparedCssSurfaceShell['faces'][number] {
  return { id, centerUnits, faceNormal, radialNormal, atlasStepPixels: [20, 30], atlasOriginPixels: [2, -3],
    style: { width: '12px', height: '14px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1)', backgroundSize: '80px 60px' } };
}
function vertexFixture(): PreparedCssSurfaceShell {
  const base = fixture(), triangle = face('triangle', [0, -1 / 3, 1], [0, 0, 1], [0, 0, 1]);
  return { ...base, atlas: { path: 'materials/rim.png', tileSize: 16, columns: 5, frames: 20, facingLevels: [-1, 0, .5, 1] },
    vertices: [{ positionUnits: [-1, -1, 1], radialNormal: [1, 0, 0] },
      { positionUnits: [1, -1, 1], radialNormal: [0, 1, 0] }, { positionUnits: [0, 1, 1], radialNormal: [0, 0, 1] }],
    faces: [{ ...triangle, vertexIndices: [0, 1, 2], materialTransforms: [triangle.style.transform,
      ...[1, 2, 3, 4, 5].map(i => `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,${i},0,0,1)`)] }],
    resources: [{ ...base.resources[0]!, width: 80, height: 64 }] };
}

/** Deliberately corrupt a known fixture without weakening the contract's readonly types. */
function setField(input: unknown, path: readonly (string | number)[], value?: unknown): void {
  let target: unknown = input;
  for (const key of path.slice(0, -1)) {
    assert.ok(target !== null && typeof target === 'object');
    target = Reflect.get(target, key);
  }
  assert.ok(target !== null && typeof target === 'object');
  const key = path[path.length - 1]!;
  if (value === undefined) Reflect.deleteProperty(target, key);
  else Reflect.set(target, key, value);
}

for (const [_name, mutate] of [
  ['missing prepared vertices', (data: PreparedCssSurfaceShell) => { setField(data, ['vertices']); }],
  ['unsorted facing levels', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'facingLevels'], [-1, .5, 0, 1]); }],
  ['incomplete triple bank', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'frames'], 19); }],
  ['out-of-range vertex', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'vertexIndices', 2], 3); }],
  ['missing corner permutation', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'materialTransforms'], data.faces[0]!.materialTransforms!.slice(0, -1)); }],
  ['runtime transform expression', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'materialTransforms', 1], 'rotate(20deg)'); }],
  ['wrong initial permutation', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'materialTransforms', 0], data.faces[0]!.materialTransforms![1]); }],
  ['nonunit vertex normal', (data: PreparedCssSurfaceShell) => { setField(data, ['vertices', 0, 'radialNormal'], [2, 0, 0]); }],
] as const) test(`rejects vertex material ${_name}`, () => {
  const payload = structuredClone(vertexFixture()); mutate(payload);
  assert.throws(() => validatePreparedCssSurfaceShell(payload), TypeError);
});

test('validates the complete shell with strict compiled material and geometry fields', () => {
  const payload = fixture();
  assert.deepEqual(validatePreparedCssSurfaceShell(payload), payload);
  const exponential = { ...payload, faces: [{ ...payload.faces[0], style: { ...payload.faces[0]!.style, transform: 'matrix3d(1e0,0,0,0,0,+1,0,0,0,0,1,0,-1e-3,2.5,3,1)' } }] };
  assert.equal(validatePreparedCssSurfaceShell(exponential).faces.length, 1);
});

for (const [_name, mutate] of [
  ['missing key', (data: PreparedCssSurfaceShell) => { setField(data, ['unitScale']); }],
  ['extra top-level key', (data: PreparedCssSurfaceShell) => { setField(data, ['shader'], ''); }],
  ['nonpositive unit scale', (data: PreparedCssSurfaceShell) => { setField(data, ['unitScale'], 0); }],
  ['bad reference quaternion', (data: PreparedCssSurfaceShell) => { setField(data, ['frame', 'localToReferenceXyzw'], [0, 0, 0, 2]); }],
  ['nonfinite camera frame', (data: PreparedCssSurfaceShell) => { setField(data, ['frame', 'originM', 0], Infinity); }],
  ['reversed distance gates', (data: PreparedCssSurfaceShell) => { setField(data, ['visibility', 'fullUntilM'], 200); }],
  ['nonfinite distance gate', (data: PreparedCssSurfaceShell) => { setField(data, ['visibility', 'hiddenBeyondM'], Infinity); }],
  ['extra visibility key', (data: PreparedCssSurfaceShell) => { setField(data, ['visibility', 'focusRange'], 1); }],
  ['empty faces', (data: PreparedCssSurfaceShell) => { setField(data, ['faces'], []); }],
  ['unbounded faces', (data: PreparedCssSurfaceShell) => { setField(data, ['faces'], Array(20_001).fill(data.faces[0])); }],
  ['duplicate face id', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 1, 'id'], data.faces[0]!.id); }],
  ['nonfinite center', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'centerUnits', 0], NaN); }],
  ['nonunit geometric normal', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'faceNormal'], [0, 0, 2]); }],
  ['nonunit radial normal', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'radialNormal'], [0, 0, 0]); }],
  ['extra face key', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'texturePath'], 'other.png'); }],
  ['invalid atlas step', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'atlasStepPixels', 0], -1); }],
  ['nonfinite atlas origin', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'atlasOriginPixels', 0], Infinity); }],
  ['runtime style property', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'opacity'], '0.2'); }],
  ['runtime style expression', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'width'], 'calc(10px + 1px)'); }],
  ['zero face dimension', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'height'], '0px'); }],
  ['negative background size', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'backgroundSize'], '-1px 1px'); }],
  ['runtime transform URL', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'transform'], 'url(/generated.png)'); }],
  ['short matrix', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'transform'], 'matrix3d(1,0,0,0)'); }],
  ['blank matrix element', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'transform'], 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,,2,3,1)'); }],
  ['non-numeric matrix element', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'transform'], 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,null,2,3,1)'); }],
  ['nonfinite matrix element', (data: PreparedCssSurfaceShell) => { setField(data, ['faces', 0, 'style', 'transform'], 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1e999,2,3,1)'); }],
  ['atlas path traversal', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'path'], '../rim.png'); setField(data, ['resources', 0, 'path'], '../rim.png'); }],
  ['encoded atlas traversal', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'path'], '%2e%2e/rim.png'); setField(data, ['resources', 0, 'path'], '%2e%2e/rim.png'); }],
  ['atlas external URL', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'path'], 'https://host/rim.png'); setField(data, ['resources', 0, 'path'], data.atlas.path); }],
  ['atlas wrong format', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'path'], 'rim.svg'); setField(data, ['resources', 0, 'path'], 'rim.svg'); }],
  ['missing atlas resource', (data: PreparedCssSurfaceShell) => { setField(data, ['resources'], []); }],
  ['resource mismatch', (data: PreparedCssSurfaceShell) => { setField(data, ['resources', 0, 'path'], 'other.png'); }],
  ['stray resource hash', (data: PreparedCssSurfaceShell) => { setField(data, ['resources', 0, 'sha256'], 'a'.repeat(64)); }],
  ['invalid resource byte length', (data: PreparedCssSurfaceShell) => { setField(data, ['resources', 0, 'bytes'], 0); }],
  ['wrong atlas dimensions', (data: PreparedCssSurfaceShell) => { setField(data, ['resources', 0, 'height'], 64); }],
  ['fractional atlas frame count', (data: PreparedCssSurfaceShell) => { setField(data, ['atlas', 'frames'], 1.5); }],
  ['missing provenance', (data: PreparedCssSurfaceShell) => { setField(data, ['provenance'], null); }],
] as const) test(`rejects ${_name}`, () => {
  const payload = structuredClone(fixture()); mutate(payload);
  assert.throws(() => validatePreparedCssSurfaceShell(payload), TypeError);
});

