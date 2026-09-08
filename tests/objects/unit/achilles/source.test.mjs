import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Achilles",
  "modelId": 3934,
  "modelVersion": "2019-05-07",
  "shapeSha256": "38db827d7d93b048832ba643e1644e072e5fb5a681e122f3085e9735600220ca",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.213856,
    0.137399,
    0.527411
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001105953205,
  "diameterKm": 131.0,
  "uncertaintyKm": 8.0,
  "beta": -5.0,
  "periodHours": 7.3063,
  "lambda": 172.0
};

test("Achilles preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("achilles", independentExpected));
