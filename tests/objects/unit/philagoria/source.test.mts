import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 883,
  "shapeSha256": "d00a5edc3e2c3ccfd5fc8ec04d264eb5fc651bf5b4015258f7878aa48f1bae1d",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.286241,
    0.568167,
    0.393378
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000004297950709,
  "diameterKm": 27.32,
  "uncertaintyKm": 0.71,
  "lambda": 274.0,
  "beta": -78.0,
  "periodHours": 17.94082,
  "name": "Philagoria",
  "modelVersion": "2016-01-04"
};

test("Philagoria preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("philagoria", independentExpected));
