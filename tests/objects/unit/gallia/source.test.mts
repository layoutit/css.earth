import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4618,
  "shapeSha256": "dfae149a3e1dd7938f6bb711488c8d230804ca7efe942f776479be14f138ab0a",
  "vertices": 572,
  "faces": 1140,
  "firstVertex": [
    0.233641,
    -0.116575,
    0.630921
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001993945815,
  "diameterKm": 80.87,
  "uncertaintyKm": 1.04,
  "lambda": 140.0,
  "beta": -17.0,
  "periodHours": 20.6636,
  "name": "Gallia",
  "modelVersion": "2019-10-23"
};

test("Gallia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("gallia", independentExpected));
