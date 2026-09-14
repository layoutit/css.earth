import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/io-85/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'io-85',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/io-85/io-85-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/io-85/io-85-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
