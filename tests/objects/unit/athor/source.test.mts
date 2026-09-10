import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 461,
  "shapeSha256": "bb13c3b5a03f3f095adfface5145e8780cf80bc7e1ad0d48172c367cb669c4fd",
  "vertices": 1008,
  "faces": 2012,
  "firstVertex": [
    0.179,
    0.349342,
    0.490586
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000064037925,
  "diameterKm": 40.84,
  "uncertaintyKm": 0.52,
  "lambda": 350.0,
  "beta": -6.0,
  "periodHours": 7.280086,
  "name": "Athor",
  "modelVersion": "2012-09-25"
};

test("Athor preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("athor", independentExpected));
