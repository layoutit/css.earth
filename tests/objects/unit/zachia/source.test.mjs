import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Zachia",
  "modelId": 5901,
  "modelVersion": "2019-10-23",
  "shapeSha256": "fa76a68f24cbff7a331e2ddb0f72a5080b431c4332d1f91ffc109d28088da6b4",
  "vertices": 552,
  "faces": 1100,
  "firstVertex": [
    -0.252995,
    0.266479,
    0.669881
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999842913777,
  "diameterKm": 16.848,
  "uncertaintyKm": 0.182,
  "beta": 29.0,
  "periodHours": 22.836,
  "lambda": 28.0
};

test("Zachia preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("zachia", independentExpected));
