import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Dike",
  "modelId": 1144,
  "modelVersion": "2016-01-04",
  "shapeSha256": "fa976b4d7167a12345ebcc95c09b74f06e4700a16ce25c9a8381e2a8de94626f",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.01634,
    0.215417,
    0.572039
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000222552459,
  "diameterKm": 66.5,
  "uncertaintyKm": 0.9,
  "lambda": 233.0,
  "beta": 50.0,
  "periodHours": 18.11914
};

test("Dike preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("dike", independentExpected));
