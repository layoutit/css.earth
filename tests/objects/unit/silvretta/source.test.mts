import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Silvretta",
  "modelId": 513,
  "modelVersion": "2013-02-11",
  "shapeSha256": "f2abcec4e89d1fbe1b297e546e91239b04bb94ce621998061ddeee09acee3724",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    -0.071702,
    0.101342,
    0.558953
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001227802775,
  "diameterKm": 26.393,
  "uncertaintyKm": 0.439,
  "lambda": 161.0,
  "beta": -46.0,
  "periodHours": 7.067967
};

test("Silvretta preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("silvretta", independentExpected));
