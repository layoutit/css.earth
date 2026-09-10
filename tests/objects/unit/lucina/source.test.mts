import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1837,
  "shapeSha256": "667acd4065c0ea2b9930418669bc923020620d6bb64268b432a4f60cd2daa19c",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    0.84247,
    7.325641,
    72.711028
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1909126.222472582,
  "diameterKm": 154.0,
  "uncertaintyKm": 15.0,
  "lambda": 304.0,
  "beta": -41.0,
  "periodHours": 18.5538,
  "name": "Lucina",
  "modelVersion": "2017-09-21"
};

test("Lucina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lucina", independentExpected));
