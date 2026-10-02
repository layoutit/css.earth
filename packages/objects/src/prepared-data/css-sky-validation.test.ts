import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREPARED_CSS_SKY_SCHEMA, type PreparedCssSky } from './css-sky-types.js';
import { validatePreparedCssSky, validatePreparedSkyParallax } from './css-sky-validation.js';

const bases = [
  ['px', [1, 0, 0], [0, -1, 0], [0, 0, 1]], ['nx', [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  ['py', [0, 1, 0], [1, 0, 0], [0, 0, 1]], ['ny', [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
  ['pz', [0, 0, 1], [0, -1, 0], [-1, 0, 0]], ['nz', [0, 0, -1], [0, -1, 0], [1, 0, 0]],
] as const;
const fixture = (): PreparedCssSky => ({ schema: PREPARED_CSS_SKY_SCHEMA, referenceFrame: 'fixture', epochJdTt: 123, radiusUnits: 1,
  faces: bases.map(([id, forwardIcrf, rightIcrf, upIcrf]) => ({ id, forwardIcrf, rightIcrf, upIcrf, texturePath: `sky/${id}.webp`, widthPx: 1536, heightPx: 1536,
    style: { width: '100px', height: '100px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-50,-50,-50,1)', backgroundSize: '100px 100px', backgroundPosition: '0px 0px' } })),
  provenance: {}, approximation: {} });
const resources = fixture().faces.map(face => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: 100 }));

test('validates six inward orthonormal faces, exact resource metadata and URL-free numeric CSS', () => {
  const sky = fixture(); assert.equal(validatePreparedCssSky(sky, resources), sky);
  for (const replacement of [{ ...sky, extra: true }, { ...sky, faces: sky.faces.slice(1) }, { ...sky, faces: [...sky.faces.slice(0, 5), sky.faces[0]] },
    ...[{ upIcrf: [0, 1, 0] }, { rightIcrf: [0, 1, 0] }, { texturePath: '../sky/px.webp' }, { widthPx: 1 },
      { style: { ...sky.faces[0]!.style, transform: 'matrix3d(1,0,0)' } }, { style: { ...sky.faces[0]!.style, backgroundImage: 'url(remote)' } }]
      .map(face => ({ ...sky, faces: [{ ...sky.faces[0], ...face }, ...sky.faces.slice(1)] }))]) assert.throws(() => validatePreparedCssSky(replacement, resources));
  assert.throws(() => validatePreparedCssSky(sky, resources.slice(1)), /resource/);
});

test('parallax validates finite physical origin and positive scale without changing the record', () => {
  const parallax = { originM: [1, 2, 3], metersPerCssPixel: 100 };
  assert.equal(validatePreparedSkyParallax(parallax), parallax);
  const sky = { ...fixture(), parallax }; assert.equal(validatePreparedCssSky(sky, resources), sky);
  for (const replacement of [{ originM: [NaN, 0, 0] }, { originM: [0, 0] }, { metersPerCssPixel: 0 }, { extra: true }]) {
    assert.throws(() => validatePreparedCssSky({ ...sky, parallax: { ...parallax, ...replacement } }, resources), /parallax/);
  }
});
