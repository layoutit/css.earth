import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 304,
  "shapeSha256": "1805d5dbef19e6956892f348a8f2bfea20036c710c9641352aebd224cde62acd",
  "vertices": 998,
  "faces": 1992,
  "firstVertex": [
    -0.100366,
    0.020804,
    0.564742
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999695071565,
  "diameterKm": 64.08,
  "uncertaintyKm": 0.77,
  "lambda": 266.0,
  "beta": 5.0,
  "periodHours": 5.750249,
  "name": "Phaedra",
  "modelVersion": "2011-02-18"
};

test("Phaedra preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("phaedra", independentExpected));
