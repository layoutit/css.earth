import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 578,
  "shapeSha256": "d4074decf77b04ae946a4cde54bd9a3ea1179f3ab447ac7721d81d8ea378873c",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    0.036938,
    -0.001135,
    0.568536
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998537454374,
  "diameterKm": 95.2,
  "uncertaintyKm": 1.36,
  "lambda": 206.0,
  "beta": -19.0,
  "periodHours": 8.29055,
  "name": "Huberta",
  "modelVersion": "2013-02-11"
};

test("Huberta preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("huberta", independentExpected));
