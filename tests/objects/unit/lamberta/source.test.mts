import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5914,
  "shapeSha256": "2e81472c1dd7a834d7ab49f42b4d545f3a1a7e506194ef887534d3499bde492e",
  "vertices": 902,
  "faces": 1800,
  "firstVertex": [
    5.873481,
    -12.402587,
    63.304541
  ],
  "firstFace": [
    303,
    103,
    308
  ],
  "signedVolume": 1470693.7403402955,
  "diameterKm": 141.0,
  "uncertaintyKm": 2.0,
  "lambda": 115.0,
  "beta": -80.0,
  "periodHours": 10.66703,
  "name": "Lamberta",
  "modelVersion": "2021-11-12"
};

test("Lamberta preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lamberta", independentExpected));
