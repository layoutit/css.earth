import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 139,
  "shapeSha256": "2f8825e7125544f7cbcf50fa479dc601268d3add0960b3acb46f0696c90eabb4",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    5.436602,
    -3.629648,
    33.085253
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 179594.36790669643,
  "diameterKm": 70.0,
  "uncertaintyKm": 7.0,
  "lambda": 223.0,
  "beta": 18.0,
  "periodHours": 4.804043,
  "name": "55 Pandora",
  "modelVersion": "2011-03-28"
};

test("55 Pandora preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("pandora-55", independentExpected));
