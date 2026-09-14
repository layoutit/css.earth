import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/lamberta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lamberta',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lamberta/lamberta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lamberta/lamberta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
