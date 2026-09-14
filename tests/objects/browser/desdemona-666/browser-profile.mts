import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/desdemona-666/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'desdemona-666',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/desdemona-666/desdemona-666-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/desdemona-666/desdemona-666-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
