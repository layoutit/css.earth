import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Echo",
  "modelId": 1695,
  "modelVersion": "2016-01-12",
  "shapeSha256": "ddc352f155debfd2b7982465401013ccfa65ab66e907975442f94c79fa937b72",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.19291,
    0.469908,
    0.460967
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001812373185,
  "diameterKm": 58.95,
  "uncertaintyKm": 1.24,
  "lambda": 91.0,
  "beta": -25.0,
  "periodHours": 25.2285
};

test("Echo preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("echo", independentExpected));
