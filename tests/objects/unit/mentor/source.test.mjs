import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4281,
  "shapeSha256": "649f240ede7aa6604f30dd9a05ddf905cc9bf0ff53d1765c5265f89082b195ab",
  "vertices": 572,
  "faces": 1140,
  "firstVertex": [
    -0.053264,
    0.270474,
    0.574945
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001243334133,
  "diameterKm": 126.288,
  "uncertaintyKm": 1.642,
  "lambda": 237.0,
  "beta": 57.0,
  "periodHours": 7.69659,
  "name": "Mentor",
  "modelVersion": "2019-05-07"
};

test("Mentor preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("mentor", independentExpected));
