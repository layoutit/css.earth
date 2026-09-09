import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 189,
  "shapeSha256": "10aace4ab515e08cf5ecbfe77fd3a7fc9f559519d9202ef6a2edd7b106ffe187",
  "vertices": 1598,
  "faces": 3192,
  "firstVertex": [
    10.096305,
    -1.454118,
    60.893704
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1022653.8517369278,
  "diameterKm": 104.0,
  "uncertaintyKm": 11.0,
  "lambda": 9.0,
  "beta": -4.0,
  "periodHours": 6.3192,
  "name": "Adelheid",
  "modelVersion": "2011-03-28"
};

test("Adelheid preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("adelheid", independentExpected));
