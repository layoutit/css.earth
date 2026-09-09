import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1088,
  "shapeSha256": "0b7c71c3ad49bdc31f45d662a68f4f4a29a637c6399b280eeb74a8eee9377d94",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.233176,
    0.201727,
    0.491973
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998497823462,
  "diameterKm": 104.24,
  "uncertaintyKm": 1.29,
  "lambda": 286.0,
  "beta": 18.0,
  "periodHours": 16.48013,
  "name": "Ianthe",
  "modelVersion": "2016-01-04"
};

test("Ianthe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ianthe", independentExpected));
