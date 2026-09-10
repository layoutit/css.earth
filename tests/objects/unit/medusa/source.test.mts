import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 570,
  "shapeSha256": "ac8826e64a7f1eb168ab78c9ed24005a668817f2f32137eecf417ce94a9ee6c0",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.295125,
    -0.036144,
    0.378932
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998108064263,
  "diameterKm": 21.41,
  "uncertaintyKm": 0.35,
  "lambda": 173.0,
  "beta": -78.0,
  "periodHours": 26.0455,
  "name": "Medusa",
  "modelVersion": "2013-02-11"
};

test("Medusa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("medusa", independentExpected));
