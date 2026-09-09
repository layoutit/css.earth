import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 557,
  "shapeSha256": "903c54800b229e30bd4b5b7aed8a99f3bef189f87ccf99d29fdce35aea38979c",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.051621,
    0.254446,
    0.556608
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000565962182,
  "diameterKm": 108.41,
  "uncertaintyKm": 1.67,
  "lambda": 90.0,
  "beta": 14.0,
  "periodHours": 7.85227,
  "name": "Protogeneia",
  "modelVersion": "2013-02-11"
};

test("Protogeneia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("protogeneia", independentExpected));
