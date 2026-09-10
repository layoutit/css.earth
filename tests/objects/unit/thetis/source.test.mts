import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 116,
  "shapeSha256": "4ab3bb84cf020ea326fe445362fbb7105effa1754ce56fccccc83f4eb861f8d3",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    16.549248,
    1.300069,
    33.950293
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 239040.12475906694,
  "diameterKm": 77.0,
  "uncertaintyKm": 8.0,
  "lambda": 236.0,
  "beta": 19.0,
  "periodHours": 12.26603,
  "name": "Thetis",
  "modelVersion": "2011-03-28"
};

test("Thetis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("thetis", independentExpected));
