import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/vindobona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vindobona',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/vindobona/vindobona-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/vindobona/vindobona-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
