import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Bertha",
  "modelId": 939,
  "modelVersion": "2016-01-04",
  "shapeSha256": "6abfad40c2918c98a2918bcf4257174cb58c7a75871bb00f9f4cdf382241a32f",
  "vertices": 1010,
  "faces": 2016,
  "firstVertex": [
    0.077069,
    0.061401,
    0.666754
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999525456609,
  "diameterKm": 185.83,
  "uncertaintyKm": 2.72,
  "lambda": 234.0,
  "beta": 32.0,
  "periodHours": 25.2287
};

test("Bertha preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("bertha", independentExpected));
