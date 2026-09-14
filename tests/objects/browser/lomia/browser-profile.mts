import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/lomia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lomia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lomia/lomia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lomia/lomia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
