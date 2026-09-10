import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Mr. Spock",
  "modelId": 4874,
  "modelVersion": "2019-10-23",
  "shapeSha256": "ff1b2b9b522e5f7acc86b42876904882375f591146b706775e37525eac39b065",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.229144,
    0.511282,
    0.481333
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000406330114,
  "diameterKm": 19.707,
  "uncertaintyKm": 0.177,
  "lambda": 255.0,
  "beta": -41.0,
  "periodHours": 6.72088
};

test("Mr. Spock preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("mr-spock", independentExpected));
