import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4695,
  "shapeSha256": "f5b9e2aa2266ce412b20de2bddc7242224f042d7aa0aecbb1a579d00ab6d18ba",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.282909,
    -0.006634,
    0.655229
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000004253036394,
  "diameterKm": 66.89,
  "uncertaintyKm": 0.82,
  "lambda": 203.0,
  "beta": -52.0,
  "periodHours": 27.41,
  "name": "Baucis",
  "modelVersion": "2019-10-23"
};

test("Baucis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("baucis", independentExpected));
