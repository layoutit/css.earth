import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/thule/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thule',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/thule/thule-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/thule/thule-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
