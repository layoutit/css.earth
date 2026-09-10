import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 8131,
  "shapeSha256": "6d021451ff77ee883cf053c605fdcd6de8774910a6f553e3734bfadbff7e7b8e",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.336234,
    0.358317,
    0.454415
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998567750215,
  "diameterKm": 42.716,
  "uncertaintyKm": 0.517,
  "lambda": 327.0,
  "beta": 66.0,
  "periodHours": 17.7464,
  "name": "Menelaus",
  "modelVersion": "2022-11-29"
};

test("Menelaus preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("menelaus", independentExpected));
