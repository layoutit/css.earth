import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4148,
  "shapeSha256": "b350d98f2dc934419375ae342ce7c825dc290eebe41efc3e943ca51ed62dc85b",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.196179,
    0.179196,
    0.686575
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000905304047,
  "diameterKm": 80.07,
  "uncertaintyKm": 0.97,
  "lambda": 223.0,
  "beta": 49.0,
  "periodHours": 14.2447,
  "name": "Vindobona",
  "modelVersion": "2019-05-07"
};

test("Vindobona preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("vindobona", independentExpected));
