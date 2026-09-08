import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Selinur",
  "modelId": 5480,
  "modelVersion": "2019-10-23",
  "shapeSha256": "0f6e095aa7d97f1e68e0bf67a68cd9c54c1700c09055ee92f60e743f9117e531",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.333836,
    0.040355,
    0.567468
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999725505557,
  "diameterKm": 40.828,
  "uncertaintyKm": 0.247,
  "beta": -56.0,
  "periodHours": 8.0117,
  "lambda": 136.0
};

test("Selinur preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("selinur", independentExpected));
