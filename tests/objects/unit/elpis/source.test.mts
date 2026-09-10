import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6156,
  "shapeSha256": "6a4303f1791e988fba36d8524815aa00799d0268b7f81d4d263da431f15b331f",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.066964,
    0.06909,
    0.512187
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000565150609,
  "diameterKm": 156.18,
  "uncertaintyKm": 2.31,
  "lambda": 300.0,
  "beta": -55.0,
  "periodHours": 13.6747,
  "name": "Elpis",
  "modelVersion": "2022-02-14"
};

test("Elpis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("elpis", independentExpected));
