import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/nereus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nereus',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/nereus/nereus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nereus/nereus-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
