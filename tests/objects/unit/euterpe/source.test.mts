import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 441,
  "shapeSha256": "0805b6f32ecb1e5e05c9c5a2f79c4cfa521a2370860b4930a728613d2e9bbc9a",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.163634,
    -0.075238,
    0.527435
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999287216701,
  "diameterKm": 109.79,
  "uncertaintyKm": 1.54,
  "lambda": 258.0,
  "beta": -42.0,
  "periodHours": 10.40828,
  "name": "Euterpe",
  "modelVersion": "2011-10-27"
};

test("Euterpe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("euterpe", independentExpected));
