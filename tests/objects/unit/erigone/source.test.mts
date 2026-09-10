import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1399,
  "shapeSha256": "6aad46d87b3e7994de886e34871bc6c1d2979208ffaeeb345945cae43f2f778a",
  "vertices": 1005,
  "faces": 2006,
  "firstVertex": [
    0.439359,
    -0.055689,
    0.433499
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000484983402,
  "diameterKm": 72.14,
  "uncertaintyKm": 0.95,
  "lambda": 191.0,
  "beta": -75.0,
  "periodHours": 16.14032,
  "name": "Erigone",
  "modelVersion": "2017-05-11"
};

test("Erigone preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("erigone", independentExpected));
