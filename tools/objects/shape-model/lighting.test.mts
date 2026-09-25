import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { multiplyPreparedMatrix4, preparedRotationMatrix4, transformPreparedPoint } from '@cssearth/core';
import { createPreparedNodeTree } from '../../prepared/prepared-node-tree.mts';
import { prepareShapeLighting } from './lighting.mts';

// Haumea's axes and display radius; any camera reference works, the plate follows it.
const plate = (pixels: number) => {
  const builder = createPreparedNodeTree(), root = builder.mesh('polycss-scene');
  builder.append(null, root);
  const lighting = prepareShapeLighting({ builder, root, axes: [1161, 852, 513], config: { displayRadius: 230 },
    scene: { systemTransform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', camera: { initialScenePitchDegrees: 40, defaultControlYawDegrees: -25 } },
    image: { width: pixels, height: pixels }, objectId: 'fixture' });
  const track = lighting.track(0), rotation = track.rotation;
  if (rotation?.kind !== 'ellipsoid') throw new TypeError('Expected an ellipsoid lighting plate.');
  return { style: lighting.leaf.style.preparedRecord().style, track, rotation };
};

test('the lighting plate shows its image at two texels per CSS pixel', () => {
  const { style, track, rotation } = plate(512);
  assert.equal(style, 'width:256px;height:256px');
  assert.equal(rotation.width, 256);
  assert.deepEqual(track.banks[0]!.frames.map(frame => frame.backgroundSize), ['256px 256px']);
});

test('the plate covers the same projected disc whatever its image size', () => {
  // The runtime composes baseProjection · C · Rz(roll) · C⁻¹ over box pixels (prepared-ellipsoid-projection.ts); a box point at
  // the same fraction of the plate must land on the same scene point for any box size.
  const scene = (pixels: number, u: number, v: number, degrees: number) => {
    const { width, projection } = plate(pixels).rotation;
    const matrix = multiplyPreparedMatrix4(projection.baseProjection, multiplyPreparedMatrix4(projection.centerTranslation,
      multiplyPreparedMatrix4(preparedRotationMatrix4('z', degrees), projection.inverseCenterTranslation)));
    const point = transformPreparedPoint(matrix, u * width, v * width, 0, 1);
    return [point.x, point.y, point.z];
  };
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [.37, .61]]) for (const degrees of [0, 37]) {
    const small = scene(512, u, v, degrees), large = scene(2048, u, v, degrees);
    for (const axis of [0, 1, 2]) assert.ok(Math.abs(small[axis]! - large[axis]!) < 1e-9 * (1 + Math.abs(large[axis]!)), `${u},${v} at ${degrees}°`);
  }
});

test('a lighting image that is not square is refused with the body named', () => {
  assert.throws(() => {
    const builder = createPreparedNodeTree(), root = builder.mesh('polycss-scene');
    prepareShapeLighting({ builder, root, axes: [1, 1, 1], config: { displayRadius: 230 },
      scene: { systemTransform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', camera: { initialScenePitchDegrees: 0, defaultControlYawDegrees: 0 } },
      image: { width: 512, height: 256 }, objectId: 'fixture' });
  }, /fixture: the shape lighting image must be square/);
});
