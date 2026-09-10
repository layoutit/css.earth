import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Badenia",
  "modelId": 3298,
  "modelVersion": "2019-05-07",
  "shapeSha256": "d980d1f15c81c92866789a3a2728cbcfdf57908045eaed0022b5dc22e01ebfef",
  "vertices": 572,
  "faces": 1140,
  "firstVertex": [
    0.220602,
    0.326196,
    0.555599
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.00000000195728,
  "diameterKm": 69.73,
  "uncertaintyKm": 2.8,
  "lambda": 5.0,
  "beta": -54.0,
  "periodHours": 9.86107
};

test("Badenia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("badenia", independentExpected));
