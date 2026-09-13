import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/felicitas/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'felicitas',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/felicitas/felicitas-directional-sun.webp",
      "two": "/scenes/felicitas/felicitas-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/felicitas/felicitas-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/felicitas/felicitas-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
