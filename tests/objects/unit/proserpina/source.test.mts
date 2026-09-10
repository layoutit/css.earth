import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Proserpina",
  "modelId": 1189,
  "modelVersion": "2016-01-04",
  "shapeSha256": "5451a43f38b22110427c9ac5aee9fc2dba99a37ef7248f5f3986bca7f375f2f7",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.112063,
    0.223624,
    0.513633
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000002492354696,
  "diameterKm": 87.45,
  "uncertaintyKm": 0.95,
  "lambda": 88.0,
  "beta": -52.0,
  "periodHours": 13.10977
};

test("Proserpina preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("proserpina", independentExpected));
