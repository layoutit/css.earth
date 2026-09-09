import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 506,
  "shapeSha256": "3482d76fa479e2335f9e524abeaa2a38a9f0d974298a2520006bfa807d2cd056",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.178419,
    0.236949,
    0.446121
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000080119383,
  "diameterKm": 54.65,
  "uncertaintyKm": 1.33,
  "lambda": 165.0,
  "beta": 9.0,
  "periodHours": 5.22063,
  "name": "Byblis",
  "modelVersion": "2013-02-26"
};

test("Byblis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("byblis", independentExpected));
