import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/iclea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iclea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/iclea/iclea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/iclea/iclea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
