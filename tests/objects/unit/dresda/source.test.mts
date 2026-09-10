import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1163,
  "shapeSha256": "eb9e234766f9bce4ed9fd95ff4e674802af3255a98ae411a37b3a36f5f52b230",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.168762,
    0.22259,
    0.534643
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000072370686,
  "diameterKm": 25.74,
  "uncertaintyKm": 0.57,
  "lambda": 99.0,
  "beta": 54.0,
  "periodHours": 16.81385,
  "name": "Dresda",
  "modelVersion": "2016-01-04"
};

test("Dresda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("dresda", independentExpected));
