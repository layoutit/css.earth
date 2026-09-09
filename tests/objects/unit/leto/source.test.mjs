import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 290,
  "shapeSha256": "22c388028d5da32840503e4aaa9a0985447afaf34909ca834b26e941a313f019",
  "vertices": 1016,
  "faces": 2028,
  "firstVertex": [
    44.698542,
    -13.471956,
    53.008928
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1697398.7793295216,
  "diameterKm": 148.0,
  "uncertaintyKm": 25.0,
  "lambda": 103.0,
  "beta": 43.0,
  "periodHours": 14.84547,
  "name": "Leto",
  "modelVersion": "2011-02-11"
};

test("Leto preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("leto", independentExpected));
