import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 271,
  "shapeSha256": "6838a5ad71d37ea2d341cb2b4aa37a66d698bf84202b49cbb7084c4dc4095c24",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    0.000763,
    0.059685,
    2.846967
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 212.1747578652795,
  "diameterKm": 7.4,
  "uncertaintyKm": 0.2,
  "lambda": 334.0,
  "beta": 39.0,
  "periodHours": 4.795168,
  "name": "Ivar",
  "modelVersion": "2016-04-22"
};

test("Ivar preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ivar", independentExpected));
