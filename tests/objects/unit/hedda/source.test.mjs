import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4799,
  "shapeSha256": "2960870d9b24a38294260667c205abc1a2d88ca5b62af00ff47a50747cf67838",
  "vertices": 552,
  "faces": 1100,
  "firstVertex": [
    0.153801,
    0.040916,
    0.651541
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999952555217,
  "diameterKm": 63.91,
  "uncertaintyKm": 1.0,
  "lambda": 264.0,
  "beta": -48.0,
  "periodHours": 30.105,
  "name": "Hedda",
  "modelVersion": "2019-10-23"
};

test("Hedda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hedda", independentExpected));
