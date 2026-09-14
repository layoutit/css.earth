import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/gyptis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gyptis',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/gyptis/gyptis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/gyptis/gyptis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
