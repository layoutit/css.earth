import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 185,
  "shapeSha256": "ca781392c88cb7da8f861e4f7a98da4c5d7677394a5bc8a3e79d6c7e766707d3",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -4.09076,
    -3.054028,
    57.706467
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 796328.212495522,
  "diameterKm": 115.0,
  "uncertaintyKm": 12.0,
  "lambda": 74.0,
  "beta": 27.0,
  "periodHours": 23.9845,
  "name": "Athamantis",
  "modelVersion": "2007-02-27"
};

test("Athamantis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("athamantis", independentExpected));
