/**
 * Copyright 2011-2024 CesiumJS Contributors. Apache-2.0; see cesium-LICENSE.md.
 * CesiumJS 1.145 / @cesium/engine 26.3.0, Camera.js:
 * https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Scene/Camera.js
 * The computeViewRectangle routine and its helpers are copied unchanged.
 * Only imports and the method's export declaration are adapted. This isolates
 * the calculation from Cesium's renderer; the CSS scene remains the camera owner.
 */
import BoundingSphere from "./cesium-BoundingSphere.mjs";
import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Cartographic from "@cesium/engine/Source/Core/Cartographic.js";
import defined from "@cesium/engine/Source/Core/defined.js";
import Ellipsoid from "@cesium/engine/Source/Core/Ellipsoid.js";
import Intersect from "@cesium/engine/Source/Core/Intersect.js";
import CesiumMath from "@cesium/engine/Source/Core/Math.js";
import Rectangle from "./cesium-Rectangle.mjs";

const scratchCartesian3_1 = new Cartesian3();
const scratchCartesian3_2 = new Cartesian3();
const scratchCartesian3_3 = new Cartesian3();
const scratchCartesian3_4 = new Cartesian3();
const horizonPoints = [
  new Cartesian3(),
  new Cartesian3(),
  new Cartesian3(),
  new Cartesian3(),
];

function computeHorizonQuad(camera, ellipsoid) {
  const radii = ellipsoid.radii;
  const p = camera.positionWC;

  // Find the corresponding position in the scaled space of the ellipsoid.
  const q = Cartesian3.multiplyComponents(
    ellipsoid.oneOverRadii,
    p,
    scratchCartesian3_1,
  );

  const qMagnitude = Cartesian3.magnitude(q);
  const qUnit = Cartesian3.normalize(q, scratchCartesian3_2);

  // Determine the east and north directions at q.
  let eUnit;
  let nUnit;
  if (
    Cartesian3.equalsEpsilon(qUnit, Cartesian3.UNIT_Z, CesiumMath.EPSILON10)
  ) {
    eUnit = new Cartesian3(0, 1, 0);
    nUnit = new Cartesian3(0, 0, 1);
  } else {
    eUnit = Cartesian3.normalize(
      Cartesian3.cross(Cartesian3.UNIT_Z, qUnit, scratchCartesian3_3),
      scratchCartesian3_3,
    );
    nUnit = Cartesian3.normalize(
      Cartesian3.cross(qUnit, eUnit, scratchCartesian3_4),
      scratchCartesian3_4,
    );
  }

  // Determine the radius of the 'limb' of the ellipsoid.
  const wMagnitude = Math.sqrt(Cartesian3.magnitudeSquared(q) - 1.0);

  // Compute the center and offsets.
  const center = Cartesian3.multiplyByScalar(
    qUnit,
    1.0 / qMagnitude,
    scratchCartesian3_1,
  );
  const scalar = wMagnitude / qMagnitude;
  const eastOffset = Cartesian3.multiplyByScalar(
    eUnit,
    scalar,
    scratchCartesian3_2,
  );
  const northOffset = Cartesian3.multiplyByScalar(
    nUnit,
    scalar,
    scratchCartesian3_3,
  );

  // A conservative measure for the longitudes would be to use the min/max longitudes of the bounding frustum.
  const upperLeft = Cartesian3.add(center, northOffset, horizonPoints[0]);
  Cartesian3.subtract(upperLeft, eastOffset, upperLeft);
  Cartesian3.multiplyComponents(radii, upperLeft, upperLeft);

  const lowerLeft = Cartesian3.subtract(center, northOffset, horizonPoints[1]);
  Cartesian3.subtract(lowerLeft, eastOffset, lowerLeft);
  Cartesian3.multiplyComponents(radii, lowerLeft, lowerLeft);

  const lowerRight = Cartesian3.subtract(center, northOffset, horizonPoints[2]);
  Cartesian3.add(lowerRight, eastOffset, lowerRight);
  Cartesian3.multiplyComponents(radii, lowerRight, lowerRight);

  const upperRight = Cartesian3.add(center, northOffset, horizonPoints[3]);
  Cartesian3.add(upperRight, eastOffset, upperRight);
  Cartesian3.multiplyComponents(radii, upperRight, upperRight);

  return horizonPoints;
}

const scratchPickCartesian2 = new Cartesian2();
const scratchRectCartesian = new Cartesian3();
const cartoArray = [
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
];
function addToResult(x, y, index, camera, ellipsoid, computedHorizonQuad) {
  scratchPickCartesian2.x = x;
  scratchPickCartesian2.y = y;
  const r = camera.pickEllipsoid(
    scratchPickCartesian2,
    ellipsoid,
    scratchRectCartesian,
  );
  if (defined(r)) {
    cartoArray[index] = ellipsoid.cartesianToCartographic(r, cartoArray[index]);
    return 1;
  }
  cartoArray[index] = ellipsoid.cartesianToCartographic(
    computedHorizonQuad[index],
    cartoArray[index],
  );
  return 0;
}
/**
 * Computes the approximate visible rectangle on the ellipsoid.
 *
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid that you want to know the visible region.
 * @param {Rectangle} [result] The rectangle in which to store the result
 *
 * @returns {Rectangle|undefined} The visible rectangle or undefined if the ellipsoid isn't visible at all.
 */
export const computeViewRectangle = function (ellipsoid, result) {
  ellipsoid = ellipsoid ?? Ellipsoid.default;
  const cullingVolume = this.frustum.computeCullingVolume(
    this.positionWC,
    this.directionWC,
    this.upWC,
  );
  const boundingSphere = new BoundingSphere(
    Cartesian3.ZERO,
    ellipsoid.maximumRadius,
  );
  const visibility = cullingVolume.computeVisibility(boundingSphere);
  if (visibility === Intersect.OUTSIDE) {
    return undefined;
  }

  const canvas = this._scene.canvas;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  let successfulPickCount = 0;

  const computedHorizonQuad = computeHorizonQuad(this, ellipsoid);

  successfulPickCount += addToResult(
    0,
    0,
    0,
    this,
    ellipsoid,
    computedHorizonQuad,
  );
  successfulPickCount += addToResult(
    0,
    height,
    1,
    this,
    ellipsoid,
    computedHorizonQuad,
  );
  successfulPickCount += addToResult(
    width,
    height,
    2,
    this,
    ellipsoid,
    computedHorizonQuad,
  );
  successfulPickCount += addToResult(
    width,
    0,
    3,
    this,
    ellipsoid,
    computedHorizonQuad,
  );

  if (successfulPickCount < 2) {
    // If we have space non-globe in 3 or 4 corners then return the whole globe
    return Rectangle.MAX_VALUE;
  }

  result = Rectangle.fromCartographicArray(cartoArray, result);

  // Detect if we go over the poles
  let distance = 0;
  let lastLon = cartoArray[3].longitude;
  for (let i = 0; i < 4; ++i) {
    const lon = cartoArray[i].longitude;
    const diff = Math.abs(lon - lastLon);
    if (diff > CesiumMath.PI) {
      // Crossed the dateline
      distance += CesiumMath.TWO_PI - diff;
    } else {
      distance += diff;
    }

    lastLon = lon;
  }

  // We are over one of the poles so adjust the rectangle accordingly
  if (
    CesiumMath.equalsEpsilon(
      Math.abs(distance),
      CesiumMath.TWO_PI,
      CesiumMath.EPSILON9,
    )
  ) {
    result.west = -CesiumMath.PI;
    result.east = CesiumMath.PI;
    if (cartoArray[0].latitude >= 0.0) {
      result.north = CesiumMath.PI_OVER_TWO;
    } else {
      result.south = -CesiumMath.PI_OVER_TWO;
    }
  }

  return result;
};
