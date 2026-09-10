import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 490,
  "shapeSha256": "23d5892b451e70763b68e7edc06b731de621fd79a98820621f63c11de034580e",
  "vertices": 1016,
  "faces": 2028,
  "firstVertex": [
    0.024595,
    0.105372,
    0.518526
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998305234152,
  "diameterKm": 20.87,
  "uncertaintyKm": 0.36,
  "lambda": 324,
  "beta": 45,
  "periodHours": 5.582028,
  "name": "Taurinensis",
  "modelVersion": "2013-02-11"
};

test("Taurinensis preserves its source model and approximate raster scale", () => assertCalibratedAsteroidSource("taurinensis", independentExpected));
