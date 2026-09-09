import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1797,
  "shapeSha256": "e8db727155bfaf5ccc6d996a603ed712b472a2585f75fc3c5ea9472039bbe434",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -10.327175,
    -1.505909,
    57.116159
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 2159264.132626666,
  "diameterKm": 160.0,
  "uncertaintyKm": 3.0,
  "lambda": 19.0,
  "beta": 21.0,
  "periodHours": 5.981768,
  "name": "Minerva",
  "modelVersion": "2017-06-13"
};

test("Minerva preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("minerva", independentExpected));
