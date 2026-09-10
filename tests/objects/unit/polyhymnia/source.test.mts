import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Polyhymnia",
  "modelId": 5163,
  "modelVersion": "2024-04-08",
  "shapeSha256": "ad4eef6efbc7473338d3a427724875eec7f1bf08e61afddb552a0668c44d4ee9",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.180403,
    -0.019682,
    0.606295
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999678467574,
  "diameterKm": 53.98,
  "uncertaintyKm": 0.91,
  "lambda": 185.0,
  "beta": -61.0,
  "periodHours": 18.60888
};

test("Polyhymnia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("polyhymnia", independentExpected));
