import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6195,
  "shapeSha256": "b6849947b8a92ca5438a2e91740256fc20bef247cdadb94b6ad8bdda723e4d4a",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    0.047265,
    0.408759,
    0.528238
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999964246603,
  "diameterKm": 87.42,
  "uncertaintyKm": 0.84,
  "lambda": 182.0,
  "beta": -9.0,
  "periodHours": 10.1107,
  "name": "Beatrix",
  "modelVersion": "2022-02-14"
};

test("Beatrix preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("beatrix", independentExpected));
