import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/betulia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'betulia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/betulia/betulia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/betulia/betulia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
