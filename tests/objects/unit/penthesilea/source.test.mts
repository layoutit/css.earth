import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 933,
  "shapeSha256": "e5e8054c9480dc77f4e07acaea828896f97a84bef3e60faad569047bb184efed",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.249131,
    0.260158,
    0.456955
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000272252658,
  "diameterKm": 64.0,
  "uncertaintyKm": 0.94,
  "lambda": 225.0,
  "beta": 49.0,
  "periodHours": 18.7875,
  "name": "Penthesilea",
  "modelVersion": "2016-01-04"
};

test("Penthesilea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("penthesilea", independentExpected));
