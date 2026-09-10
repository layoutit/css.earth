import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3090,
  "shapeSha256": "5ee16a0fbf9aee1a4f1dbe206cbb2c80dc0f125c7f430595b4b128676eb21584",
  "vertices": 1010,
  "faces": 2016,
  "firstVertex": [
    1.709223,
    7.314681,
    26.496573
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 87113.74661016026,
  "diameterKm": 55.0,
  "uncertaintyKm": 2.0,
  "lambda": 226.0,
  "beta": 70.0,
  "periodHours": 12.2409,
  "name": "Bavaria",
  "modelVersion": "2019-06-24"
};

test("Bavaria preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("bavaria", independentExpected));
