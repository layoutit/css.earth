import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 317,
  "shapeSha256": "c4ea27f6c40f983f44fd05f49f21a60e1d4a90a303a795361f109d13cf8c7bfb",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.17099,
    0.076507,
    0.5063
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000890705847,
  "diameterKm": 78.62,
  "uncertaintyKm": 0.9,
  "lambda": 87.0,
  "beta": 22.0,
  "periodHours": 9.21819,
  "name": "Erato",
  "modelVersion": "2011-04-21"
};

test("Erato preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("erato", independentExpected));
