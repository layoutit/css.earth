import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 142,
  "shapeSha256": "32e8a509863ce93032e7d97e906d1b7413d1c5db35b9229bee8953d0a8af54f7",
  "vertices": 1008,
  "faces": 2012,
  "firstVertex": [
    -0.144752,
    -0.053161,
    0.553814
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000444553148,
  "diameterKm": 45.4,
  "uncertaintyKm": 1.3,
  "lambda": 44.0,
  "beta": 83.0,
  "periodHours": 8.28307,
  "name": "Klytia",
  "modelVersion": "2011-04-20"
};

test("Klytia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("klytia", independentExpected));
