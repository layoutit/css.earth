import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/athamantis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'athamantis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/athamantis/athamantis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/athamantis/athamantis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
