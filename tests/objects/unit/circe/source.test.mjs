import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 129,
  "shapeSha256": "8f88f8efb84bd02178b61f335fd11196ed53786ddc60ec281bd834b9a3f1152f",
  "vertices": 900,
  "faces": 1796,
  "firstVertex": [
    -9.75142,
    12.329097,
    46.888594
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 641430.9567539276,
  "diameterKm": 107.0,
  "uncertaintyKm": 10.0,
  "lambda": 275.0,
  "beta": 51.0,
  "periodHours": 12.17458,
  "name": "Circe",
  "modelVersion": "2011-03-28"
};

test("Circe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("circe", independentExpected));
