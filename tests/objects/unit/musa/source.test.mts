import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Musa",
  "modelId": 504,
  "modelVersion": "2013-02-26",
  "shapeSha256": "5d72411f25fa692b22c7b8ccb786afcbaf6bbddc37b9b44b4975d75b4e10382b",
  "vertices": 961,
  "faces": 1918,
  "firstVertex": [
    -0.133786,
    -0.274874,
    0.531581
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000942934675,
  "diameterKm": 25.115,
  "uncertaintyKm": 0.221,
  "beta": -46.0,
  "periodHours": 5.886381,
  "lambda": 208.0
};

test("Musa preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("musa", independentExpected));
