import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/weringia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'weringia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/weringia/weringia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/weringia/weringia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
