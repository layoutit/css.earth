import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/crimea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'crimea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/crimea/crimea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/crimea/crimea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
