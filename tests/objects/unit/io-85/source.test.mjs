import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1822,
  "shapeSha256": "e36362e161a587298ba736fb964698d4ae4c01a846ce7cfb79c493eff6ddcc0f",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    1.310566,
    -0.081425,
    68.002264
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 2446349.1125020515,
  "diameterKm": 167.0,
  "uncertaintyKm": 3.0,
  "lambda": 92.0,
  "beta": -68.0,
  "periodHours": 6.874784,
  "name": "85 Io",
  "modelVersion": "2017-06-09"
};

test("85 Io preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("io-85", independentExpected));
