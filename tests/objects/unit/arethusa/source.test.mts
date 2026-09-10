import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 294,
  "shapeSha256": "d0e611cbfa92edf2dc21d0d4efae8ce2b4efb7460e63d038e63f61e115b11429",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    38.330989,
    9.338831,
    66.3131
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1663223.6727674808,
  "diameterKm": 147.0,
  "uncertaintyKm": 32.0,
  "lambda": 149.0,
  "beta": 33.0,
  "periodHours": 8.70221,
  "name": "Arethusa",
  "modelVersion": "2011-02-16"
};

test("Arethusa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("arethusa", independentExpected));
