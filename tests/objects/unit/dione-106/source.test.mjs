import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5942,
  "shapeSha256": "992f3f5a9ca46623bc42548cff241e5735ede28e48817f20be88f3c054a55ea1",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    0.217471,
    0.11555,
    0.546958
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000067862713,
  "diameterKm": 153.42,
  "uncertaintyKm": 2.38,
  "lambda": 237.0,
  "beta": 1.0,
  "periodHours": 16.2133,
  "name": "106 Dione",
  "modelVersion": "2022-02-14"
};

test("106 Dione preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("dione-106", independentExpected));
