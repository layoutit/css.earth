import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/transvaalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'transvaalia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/transvaalia/transvaalia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/transvaalia/transvaalia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
