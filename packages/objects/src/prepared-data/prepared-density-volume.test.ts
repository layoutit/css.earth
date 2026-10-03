import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreparedDensityVolume, parsePreparedDensityVolumeText } from './prepared-density-volume.js';
import { parseDensityVolumeObjectDescriptor } from '../density-volume.js';
import { DENSITY_VOLUME_FORMAT } from '../volume/volume-schemas.js';
import type { PreparedCssVolume } from '../volume/css-volume-types.js';

const valid = (): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'milky-way',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  anchors: [],
  stacks: [{ axis: 'x', leaves: [{ id: 'x-0', centerUnits: [0, 0, 0], texturePath: 'slices/x/00.png', widthPx: 2, heightPx: 2,
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'y', leaves: [{ id: 'y-0', centerUnits: [0, 0, 0], texturePath: 'slices/y/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'z', leaves: [{ id: 'z-0', centerUnits: [0, 0, 0], texturePath: 'slices/z/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] }],
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

function inputs() {
  const data = valid();
  const descriptor = { schema: 'cssearth-object@2', id: data.id, type: 'density-volume',
    properties: { volume: structuredClone(data.frame), preparation: { source: 'source/volume.json' } },
    prepared: { format: DENSITY_VOLUME_FORMAT, url: 'prepared/volume.json' } };
  const envelope = { schema: 'cssearth-prepared-object@1', id: data.id, type: 'density-volume', format: DENSITY_VOLUME_FORMAT, data };
  return { descriptor: parseDensityVolumeObjectDescriptor(descriptor), envelope };
}

test('accepts the same prepared payload without altering its serialized bytes', () => {
  const { descriptor, envelope } = inputs();
  assert.deepEqual(parsePreparedDensityVolumeText(JSON.stringify(envelope), descriptor), parsePreparedDensityVolume(envelope, descriptor));
  assert.throws(() => parsePreparedDensityVolumeText('{', descriptor), SyntaxError);
  assert.equal(JSON.stringify(parsePreparedDensityVolume(envelope, descriptor)), JSON.stringify(envelope.data));
});

test('requires an artifact and an authenticated envelope and authored identity/frame', () => {
  const { descriptor, envelope } = inputs();
  assert.throws(() => parsePreparedDensityVolume(envelope, { ...descriptor, prepared: undefined }), /A volume requires its prepared artifact/u);
  assert.throws(() => parsePreparedDensityVolume({ ...envelope, id: 'other' }, descriptor), /identity, type, or format/u);
  Object.assign(envelope.data, { id: 'other' });
  assert.throws(() => parsePreparedDensityVolume(envelope, descriptor), /Prepared volume frame does not match its authored descriptor/u);
  Object.assign(envelope.data, { id: descriptor.id });
  Object.assign(envelope.data.frame, { originM: [1, 0, 0] });
  assert.throws(() => parsePreparedDensityVolume(envelope, descriptor), /Prepared volume frame does not match its authored descriptor/u);
});
