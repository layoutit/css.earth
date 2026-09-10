import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Schaber",
  "modelId": 10836,
  "modelVersion": "2022-11-29",
  "shapeSha256": "ea0e69a263db99458dc7a9b4e3214a5c0eba1e40472ae713dae7d159fcfaec0e",
  "vertices": 552,
  "faces": 1100,
  "firstVertex": [
    0.081373,
    0.122325,
    0.745645
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000213930182,
  "diameterKm": 26.538,
  "uncertaintyKm": 0.262,
  "lambda": 109.0,
  "beta": 30.0,
  "periodHours": 6.37023
};

test("Schaber preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("schaber", independentExpected));
