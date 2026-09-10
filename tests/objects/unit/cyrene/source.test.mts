import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5972,
  "shapeSha256": "dc5fd920f10ed35377a2bbca5487dd096bd62756b3d78b4fa9007b127dc80d87",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.003686,
    0.082794,
    0.640291
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000082532208,
  "diameterKm": 70.92,
  "uncertaintyKm": 0.9,
  "lambda": 348.0,
  "beta": -52.0,
  "periodHours": 12.7087,
  "name": "Cyrene",
  "modelVersion": "2022-02-14"
};

test("Cyrene preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("cyrene", independentExpected));
