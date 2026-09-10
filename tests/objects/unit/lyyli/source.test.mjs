import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 2012,
  "shapeSha256": "5e9053bcc76b8f3f71cffec390e72d1b48e0043d8f9208949cd84b623e5dbf48",
  "vertices": 572,
  "faces": 1140,
  "firstVertex": [
    0.211825,
    0.185707,
    0.550867
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998263583666,
  "diameterKm": 27.12,
  "uncertaintyKm": 1.31,
  "lambda": 64,
  "beta": -66,
  "periodHours": 11.06207,
  "name": "Lyyli",
  "modelVersion": "2018-07-18"
};

test("Lyyli preserves its source model and approximate raster scale", () => assertCalibratedAsteroidSource("lyyli", independentExpected));
