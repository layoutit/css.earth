import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/libussa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'libussa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/libussa/libussa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/libussa/libussa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
