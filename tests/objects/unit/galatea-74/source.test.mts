import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6181,
  "shapeSha256": "6ddcee1db0ceec15c3dfae6c178336914650b00826fba507d8cd6dd3dab41087",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.114353,
    -0.018228,
    0.605881
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999930084961,
  "diameterKm": 113.09,
  "uncertaintyKm": 2.15,
  "lambda": 289.0,
  "beta": 14.0,
  "periodHours": 17.2675,
  "name": "74 Galatea",
  "modelVersion": "2022-02-14"
};

test("74 Galatea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("galatea-74", independentExpected));
