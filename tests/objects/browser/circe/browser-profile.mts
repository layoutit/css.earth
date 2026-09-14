import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/circe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'circe',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/circe/circe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/circe/circe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
