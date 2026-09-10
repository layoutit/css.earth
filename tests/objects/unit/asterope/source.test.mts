import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1823,
  "shapeSha256": "a54cba1bc20a55006d6a113902c2d73b80134391a7dd4489db3a0fecc607310a",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -3.779491,
    2.016733,
    43.901867
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 640108.623234575,
  "diameterKm": 107.0,
  "uncertaintyKm": 3.0,
  "lambda": 318.0,
  "beta": 61.0,
  "periodHours": 19.698,
  "name": "Asterope",
  "modelVersion": "2017-06-16"
};

test("Asterope preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("asterope", independentExpected));
