import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1810,
  "shapeSha256": "e011dbcecac18acc61b6cb82327ee948983b348ccc3b7c20b2c4ba11078318cf",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    2.93744,
    -5.257798,
    43.316337
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1052275.475911973,
  "diameterKm": 126.0,
  "uncertaintyKm": 3.0,
  "lambda": 205.0,
  "beta": 63.0,
  "periodHours": 4.95716,
  "name": "Antigone",
  "modelVersion": "2017-06-14"
};

test("Antigone preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("antigone", independentExpected));
