import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Gryphia",
  "modelId": 6121,
  "modelVersion": "2022-02-14",
  "shapeSha256": "05dc8e3b5778e2b2ae9b724299774be438553eb90b49329958fae9e42660f16b",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.350525,
    -0.060509,
    0.63576
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000403248857,
  "diameterKm": 14.403,
  "uncertaintyKm": 0.394,
  "beta": 26.0,
  "periodHours": 1049.0,
  "lambda": 141.0,
  "rotation": {
    "schema": "cssearth-display-orientation@1",
    "rightAscensionDegrees": 0,
    "declinationDegrees": 90,
    "phase": "arbitrary-display-phase"
  }
};

test("Gryphia preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("gryphia", independentExpected));
