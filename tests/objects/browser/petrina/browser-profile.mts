import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/petrina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'petrina',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/petrina/petrina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/petrina/petrina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
