import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4397,
  "shapeSha256": "9586fd3156698a4c8021a37ba6ad8868551a540f5412c7f3a6f06c049442488d",
  "vertices": 1009,
  "faces": 2014,
  "firstVertex": [
    0.016838,
    0.025359,
    0.452128
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998323247126,
  "diameterKm": 43.99,
  "uncertaintyKm": 0.75,
  "lambda": 179.0,
  "beta": 60.0,
  "periodHours": 7.806396,
  "name": "Peitho",
  "modelVersion": "2020-04-26"
};

test("Peitho preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("peitho", independentExpected));
