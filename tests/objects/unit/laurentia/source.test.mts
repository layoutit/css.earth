import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 325,
  "shapeSha256": "cf67b568322176e7a97e90964912e0100a8e9a552dfd757c9eac2686078cb864",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.099202,
    -0.027335,
    0.692197
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001330492443,
  "diameterKm": 85.34,
  "uncertaintyKm": 2.86,
  "lambda": 139.0,
  "beta": 64.0,
  "periodHours": 11.86917,
  "name": "Laurentia",
  "modelVersion": "2011-04-21"
};

test("Laurentia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("laurentia", independentExpected));
