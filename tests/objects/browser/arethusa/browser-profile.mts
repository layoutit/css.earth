import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/arethusa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'arethusa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/arethusa/arethusa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/arethusa/arethusa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
