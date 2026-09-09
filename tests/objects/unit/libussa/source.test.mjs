import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 331,
  "shapeSha256": "90c6c85577e5615ac761ae75898680215bdae93bdb749b5aa4905a095fdca08c",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.209507,
    0.318905,
    0.429804
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999347925574,
  "diameterKm": 57.57,
  "uncertaintyKm": 0.62,
  "lambda": 157.0,
  "beta": 18.0,
  "periodHours": 9.22794,
  "name": "Libussa",
  "modelVersion": "2011-04-21"
};

test("Libussa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("libussa", independentExpected));
