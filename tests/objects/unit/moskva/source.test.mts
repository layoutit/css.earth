import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Moskva",
  "modelId": 515,
  "modelVersion": "2013-02-11",
  "shapeSha256": "76ada158146d485d5ca583742e60825d7cdf15f7d4febff30655d63234863503",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.049821,
    0.189969,
    0.450224
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000434770595,
  "diameterKm": 31.962,
  "uncertaintyKm": 0.789,
  "beta": 59.0,
  "periodHours": 6.05581,
  "lambda": 331.0
};

test("Moskva preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("moskva", independentExpected));
