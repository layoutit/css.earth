import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3920,
  "shapeSha256": "02274aeb1ea9366ecd4cf1d93edd0ae05a027de53ad5261f0b3a1a2333755008",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.11327,
    0.03276,
    0.625727
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999560585365,
  "diameterKm": 37.696,
  "uncertaintyKm": 0.329,
  "lambda": 272.0,
  "beta": 22.0,
  "periodHours": 21.2689,
  "name": "Eumelos",
  "modelVersion": "2019-05-07"
};

test("Eumelos preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eumelos", independentExpected));
