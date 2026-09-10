import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 9003,
  "shapeSha256": "0086f2f76f18239a5345be68633ff70bec9e91ef0e30318c0157c07c72bfd27d",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.073786,
    0.00655,
    0.559807
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001088520782,
  "diameterKm": 76.31,
  "uncertaintyKm": 0.97,
  "lambda": 173.0,
  "beta": 76.0,
  "periodHours": 12.0395,
  "name": "Lilaea",
  "modelVersion": "2022-11-29"
};

test("Lilaea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lilaea", independentExpected));
