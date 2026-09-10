import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4215,
  "shapeSha256": "cf6512831a00fabbe4b577fc396a7164c99325bcc0a8e35eb7d142dde7ac5a18",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.523132,
    0.216566,
    0.579465
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999510135614,
  "diameterKm": 118.8,
  "uncertaintyKm": 0.6,
  "lambda": 153.73,
  "beta": 12.69,
  "periodHours": 24.4984,
  "name": "Diomedes",
  "modelVersion": "2019-05-07"
};

test("Diomedes preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("diomedes", independentExpected));
