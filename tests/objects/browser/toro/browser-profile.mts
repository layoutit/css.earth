import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/toro/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'toro',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/toro/toro-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/toro/toro-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
