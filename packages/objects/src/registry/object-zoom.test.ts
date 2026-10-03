import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { objectZoom } from './object-zoom.js';

const zoom = { enter: { distancePc: 5e6 }, returnBelow: { distancePc: 4e6 }, frame: { distance: { distancePc: 1e8 } } };
const descriptor = (value: unknown) => ({ schema: 'cssearth-object@2', id: 'local-group', type: 'layered-body', properties: { zoom: value } });

describe('object zoom facts', () => {
  it('reads the zoom facts a package authors', () => {
    assert.deepEqual(objectZoom(descriptor(zoom)), zoom);
  });

  it('leaves a package without them out', () => {
    assert.equal(objectZoom({ schema: 'cssearth-object@2', id: 'm31', type: 'x', properties: {} }), null);
  });

  it('refuses zoom facts with more or fewer fields, naming the package', () => {
    assert.throws(() => objectZoom(descriptor({ ...zoom, frame: undefined })), /src\/objects\/local-group\/object\.json properties\.zoom/);
    assert.throws(() => objectZoom(descriptor({ ...zoom, order: 2 })), /local-group.*names enter, returnBelow and frame/);
  });

  it('refuses a distance or frame outside its vocabulary, naming the field', () => {
    assert.throws(() => objectZoom(descriptor({ ...zoom, enter: { distancePc: -1 } })), /properties\.zoom\.enter/);
    assert.throws(() => objectZoom(descriptor({ ...zoom, returnBelow: { fade: 'galaxy', at: 'edge' } })), /zoom\.returnBelow/);
    assert.throws(() => objectZoom(descriptor({ ...zoom, frame: { fit: 'everything' } })), /zoom\.frame/);
    assert.deepEqual(objectZoom(descriptor({ ...zoom, frame: { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] } }))!.frame,
      { between: [{ labels: 'galaxy-handoff-end' }, { fade: 'galaxy', at: 'middle' }] });
  });
});
