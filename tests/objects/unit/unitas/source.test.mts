import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 197,
  "shapeSha256": "e3b4f00f07c7daec58d937c2ec27613c00c336979c81241dcfeb593048bbca64",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -1.294314,
    8.919461,
    24.076687
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 91952.32009268494,
  "diameterKm": 49.0,
  "uncertaintyKm": 5.0,
  "lambda": 79.0,
  "beta": -35.0,
  "periodHours": 8.73875,
  "name": "Unitas",
  "modelVersion": "2009-02-26"
};

test("Unitas preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("unitas", independentExpected));
