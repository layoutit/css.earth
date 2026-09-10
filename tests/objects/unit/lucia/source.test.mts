import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Lucia",
  "modelId": 523,
  "modelVersion": "2013-02-11",
  "shapeSha256": "295982d8c3626762ce96c29da3029b61b59e8e76fa35dcd9cf78d15b19fd7d14",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.168224,
    -0.111247,
    0.597288
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000977828636,
  "diameterKm": 52.82,
  "uncertaintyKm": 0.6,
  "lambda": 293.0,
  "beta": 49.0,
  "periodHours": 7.8367
};

test("Lucia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("lucia", independentExpected));
