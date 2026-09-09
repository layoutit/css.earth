import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 588,
  "shapeSha256": "1d751e789d79cdd53abcc6fdc6a78c1e78b560175824f814a41c5c41e8d28fc4",
  "vertices": 1012,
  "faces": 2020,
  "firstVertex": [
    0.104137,
    0.095704,
    0.508339
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000378801934,
  "diameterKm": 32.29,
  "uncertaintyKm": 0.33,
  "lambda": 26.0,
  "beta": -50.0,
  "periodHours": 18.2087,
  "name": "Stephania",
  "modelVersion": "2013-02-11"
};

test("Stephania preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("stephania", independentExpected));
