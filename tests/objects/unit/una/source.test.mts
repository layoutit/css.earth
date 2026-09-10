import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 169,
  "shapeSha256": "69285eb63614042f0cdf3bf341190155b0785cda3399191b4393a002275c6c21",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.054275,
    0.042407,
    0.619615
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999169473277,
  "diameterKm": 77.72,
  "uncertaintyKm": 1.23,
  "lambda": 125.0,
  "beta": -33.0,
  "periodHours": 11.03318,
  "name": "Una",
  "modelVersion": "2009-05-29"
};

test("Una preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("una", independentExpected));
