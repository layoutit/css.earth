import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 823,
  "shapeSha256": "8e623150e9c87568b82037ea5fae18d26f649948b9f7bb1a765c54d0c56abe03",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.10264,
    0.166076,
    0.575381
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000159165026,
  "diameterKm": 110.54,
  "uncertaintyKm": 1.57,
  "lambda": 190.0,
  "beta": -55.0,
  "periodHours": 9.92692,
  "name": "Atalante",
  "modelVersion": "2016-01-04"
};

test("Atalante preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("atalante", independentExpected));
