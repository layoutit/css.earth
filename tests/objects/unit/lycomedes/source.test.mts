import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4284,
  "shapeSha256": "7499d76e5c762b07f8c6fa687c6028f9e0b577068ffb7f951e4154cf0c140455",
  "vertices": 570,
  "faces": 1136,
  "firstVertex": [
    0.213147,
    0.321057,
    0.594659
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998529570281,
  "diameterKm": 31.736,
  "uncertaintyKm": 0.243,
  "lambda": 133.0,
  "beta": 54.0,
  "periodHours": 18.1094,
  "name": "Lycomedes",
  "modelVersion": "2019-05-07"
};

test("Lycomedes preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lycomedes", independentExpected));
