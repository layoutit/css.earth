import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1825,
  "shapeSha256": "c51298a00d557411c88c4d49eafcb6afc80fd1906891e9eb6c23829820f0c76f",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -4.68769,
    2.441266,
    17.865688
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 112418.90091404796,
  "diameterKm": 60.0,
  "uncertaintyKm": 4.0,
  "lambda": 251.0,
  "beta": -10.0,
  "periodHours": 5.761987,
  "name": "Ariadne",
  "modelVersion": "2017-06-07"
};

test("Ariadne preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ariadne", independentExpected));
