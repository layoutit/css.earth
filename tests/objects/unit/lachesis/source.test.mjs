import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 943,
  "shapeSha256": "71ab4e0c28a09ae451115ee438139b1772bdfcc1373ed9981d3fb216f6122262",
  "vertices": 1004,
  "faces": 2004,
  "firstVertex": [
    0.091141,
    0.426785,
    0.440608
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000127293381,
  "diameterKm": 156.53,
  "uncertaintyKm": 1.67,
  "lambda": 256.0,
  "beta": 39.0,
  "periodHours": 46.5508,
  "name": "Lachesis",
  "modelVersion": "2016-01-04"
};

test("Lachesis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lachesis", independentExpected));
