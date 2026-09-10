import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Hopi",
  "modelId": 10234,
  "modelVersion": "2022-11-29",
  "shapeSha256": "f461f5fbac0aae84e2a70bd02695fd6c7b30c048a41bc48fa99f0d48dc73f746",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.382133,
    0.350842,
    0.430408
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.99999999023891,
  "diameterKm": 19.267,
  "uncertaintyKm": 0.147,
  "lambda": 49.0,
  "beta": -80.0,
  "periodHours": 4.76799
};

test("Hopi preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("hopi", independentExpected));
