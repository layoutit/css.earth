import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1202,
  "shapeSha256": "0be47f09f2798dd4aa3bc7288dac1168de6bfc905e516b02c081e7bb2b151490",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    -0.063328,
    0.084822,
    0.53641
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999876716573,
  "diameterKm": 17.98,
  "uncertaintyKm": 1.34,
  "lambda": 166,
  "beta": 73,
  "periodHours": 9.19183,
  "name": "Kemi",
  "modelVersion": "2016-01-04"
};

test("Kemi preserves its source model and approximate raster scale", () => assertCalibratedAsteroidSource("kemi", independentExpected));
