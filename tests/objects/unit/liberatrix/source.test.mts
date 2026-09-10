import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 157,
  "shapeSha256": "4142c7bbb6839eac603668cbe025516b0f70887c5d70202b39c2e0d2e954552a",
  "vertices": 1598,
  "faces": 3192,
  "firstVertex": [
    0.072748,
    -0.157904,
    0.528266
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998984796639,
  "diameterKm": 51.1,
  "uncertaintyKm": 2.1,
  "lambda": 95.0,
  "beta": 68.0,
  "periodHours": 3.968198,
  "name": "Liberatrix",
  "modelVersion": "2007-02-27"
};

test("Liberatrix preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("liberatrix", independentExpected));
