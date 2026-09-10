import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 987,
  "shapeSha256": "80fd70c2bfa59866664269efb052469476bfd35078b8842e6c21cbee4c9b1108",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    0.054553,
    -0.252349,
    0.585685
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000516887726,
  "diameterKm": 69.58,
  "uncertaintyKm": 0.92,
  "lambda": 278.0,
  "beta": -26.0,
  "periodHours": 6.67191,
  "name": "Isabella",
  "modelVersion": "2016-01-04"
};

test("Isabella preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("isabella", independentExpected));
