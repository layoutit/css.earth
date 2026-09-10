import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 161,
  "shapeSha256": "c05291e6311058380b5fa35a033df4579bbfc67922699d57fba7c5898c8d5e41",
  "vertices": 1012,
  "faces": 2020,
  "firstVertex": [
    0.108006,
    0.081931,
    0.502092
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000250796424,
  "diameterKm": 44.47,
  "uncertaintyKm": 0.74,
  "lambda": 326,
  "beta": 67,
  "periodHours": 5.168274,
  "name": "Aethra",
  "modelVersion": "2011-04-19"
};

test("Aethra preserves its source model and approximate raster scale", () => assertCalibratedAsteroidSource("aethra", independentExpected));
