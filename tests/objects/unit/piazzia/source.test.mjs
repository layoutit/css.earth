import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Piazzia",
  "modelId": 3529,
  "modelVersion": "2019-05-07",
  "shapeSha256": "fb52ac0fccad4ef29a233531a572785aedd8686267f4998d3a7b090c5a93850e",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.046184,
    0.342396,
    0.588595
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000513709053,
  "diameterKm": 47.78,
  "uncertaintyKm": 2.0,
  "beta": -54.0,
  "periodHours": 9.47747,
  "lambda": 131.0
};

test("Piazzia preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("piazzia", independentExpected));
