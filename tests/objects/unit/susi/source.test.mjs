import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Susi",
  "modelId": 5856,
  "modelVersion": "2019-10-23",
  "shapeSha256": "0d6eefa2c69e4fca23e18985316ab314faaa1cf25a3b7400bb1bc8ccc486b3a6",
  "vertices": 562,
  "faces": 1120,
  "firstVertex": [
    -0.046867,
    0.15966,
    0.555268
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999315929131,
  "diameterKm": 21.82,
  "uncertaintyKm": 1.4,
  "beta": -10.0,
  "periodHours": 4.6224,
  "lambda": 301.0
};

test("Susi preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("susi", independentExpected));
