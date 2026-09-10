import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 456,
  "shapeSha256": "b573cb3c0b661359cab8c0bdedc9fdeadea2d2178fc7ffe783dc3b9b2db5915a",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.173035,
    0.351832,
    0.370047
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9047783602009508,
  "diameterKm": 1.2,
  "uncertaintyKm": null,
  "lambda": 311.0,
  "beta": -78.0,
  "periodHours": 6.803286,
  "name": "Cerberus",
  "modelVersion": "2016-04-22"
};

test("Cerberus preserves its source model, uncertain archive scale and raster triangles", () => assertCalibratedAsteroidSource("cerberus", independentExpected));
