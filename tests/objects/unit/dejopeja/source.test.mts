import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 175,
  "shapeSha256": "e455562c300f5594cb401f42d3237cb86e3e415ad7c03f54f2569637b435f9db",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -9.537533,
    5.170952,
    44.928776
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 421160.3284460244,
  "diameterKm": 93.0,
  "uncertaintyKm": 9.0,
  "lambda": 200.0,
  "beta": 52.0,
  "periodHours": 6.441111,
  "name": "Dejopeja",
  "modelVersion": "2007-09-21"
};

test("Dejopeja preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("dejopeja", independentExpected));
