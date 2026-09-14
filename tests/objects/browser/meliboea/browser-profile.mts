import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/meliboea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'meliboea',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/meliboea/meliboea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/meliboea/meliboea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
