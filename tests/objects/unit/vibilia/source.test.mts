import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1824,
  "shapeSha256": "7ad4f599bff34a11ba1ead1d48effff2f784a32ac0d456e695fff177d625ba64",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -2.509132,
    0.888169,
    62.504877
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1532024.7323014515,
  "diameterKm": 143.0,
  "uncertaintyKm": 3.0,
  "lambda": 251.0,
  "beta": 63.0,
  "periodHours": 13.82517,
  "name": "Vibilia",
  "modelVersion": "2017-06-16"
};

test("Vibilia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("vibilia", independentExpected));
