import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4511,
  "shapeSha256": "6b1581ba2bde44e3dbd3c799e1e2bea6562f10dcfd5b83ee8d07481ae37f1ed6",
  "vertices": 562,
  "faces": 1120,
  "firstVertex": [
    0.505462,
    0.262454,
    0.554141
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997189230792,
  "diameterKm": 81.39,
  "uncertaintyKm": 0.93,
  "lambda": 136.0,
  "beta": 16.0,
  "periodHours": 9.907,
  "name": "Alkeste",
  "modelVersion": "2019-10-23"
};

test("Alkeste preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("alkeste", independentExpected));
