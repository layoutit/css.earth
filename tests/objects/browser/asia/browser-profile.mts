import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/asia/asia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asia/asia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
