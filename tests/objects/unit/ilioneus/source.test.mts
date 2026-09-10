import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4172,
  "shapeSha256": "b54d7b440a854975313c728a91ae70b2e400b891081f1a510224ed50504c91a6",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.10184,
    0.212947,
    0.486064
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998637479034,
  "diameterKm": 60.711,
  "uncertaintyKm": 0.982,
  "lambda": 307.0,
  "beta": -26.0,
  "periodHours": 14.73572,
  "name": "Ilioneus",
  "modelVersion": "2019-05-07"
};

test("Ilioneus preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ilioneus", independentExpected));
