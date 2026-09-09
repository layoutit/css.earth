import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 872,
  "shapeSha256": "e6bad1a6ce84bdc4c206b59b166082c2c28e56dff40f22e1febc5df90f122f55",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.031688,
    -0.113816,
    0.682931
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999116337043,
  "diameterKm": 59.93,
  "uncertaintyKm": 0.66,
  "lambda": 235.0,
  "beta": -10.0,
  "periodHours": 16.25222,
  "name": "Asporina",
  "modelVersion": "2016-01-04"
};

test("Asporina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("asporina", independentExpected));
