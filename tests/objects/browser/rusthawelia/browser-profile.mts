import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/rusthawelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'rusthawelia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/rusthawelia/rusthawelia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/rusthawelia/rusthawelia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
