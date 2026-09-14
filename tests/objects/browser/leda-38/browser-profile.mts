import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/leda-38/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leda-38',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/leda-38/leda-38-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/leda-38/leda-38-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
