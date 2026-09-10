import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4507,
  "shapeSha256": "573126734566ace9227a24b38761a639cd45a87a447f44c115857f4e4aa904a7",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.234642,
    -0.056273,
    0.634659
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999955621184,
  "diameterKm": 48.22,
  "uncertaintyKm": 0.6,
  "lambda": 242.0,
  "beta": 38.0,
  "periodHours": 9.8735,
  "name": "Brunhild",
  "modelVersion": "2019-10-23"
};

test("Brunhild preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("brunhild", independentExpected));
