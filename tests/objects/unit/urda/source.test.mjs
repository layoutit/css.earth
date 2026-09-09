import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 172,
  "shapeSha256": "3dec127404347426e9b9f9cdcf8449c1c078b91e7e2f14f0d7fed7a4b6320dc4",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    5.614774,
    1.860468,
    21.981718
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 44602.2350783732,
  "diameterKm": 44.0,
  "uncertaintyKm": 15.0,
  "lambda": 249.0,
  "beta": -68.0,
  "periodHours": 13.06133,
  "name": "Urda",
  "modelVersion": "2011-03-28"
};

test("Urda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("urda", independentExpected));
