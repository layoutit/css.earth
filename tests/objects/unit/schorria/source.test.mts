import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Schorria",
  "modelId": 5955,
  "modelVersion": "2022-02-14",
  "shapeSha256": "4a415264ae5f3a3d9feb32668b739e2a6b0750b285553425be2a5243f86760ea",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    -0.159927,
    0.225029,
    0.353838
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001102494687,
  "diameterKm": 5.55,
  "uncertaintyKm": 1.11,
  "lambda": 103.0,
  "beta": -59.0,
  "periodHours": 1304.1
};

test("Schorria preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("schorria", independentExpected));
