import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/badenia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'badenia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/badenia/badenia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/badenia/badenia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
