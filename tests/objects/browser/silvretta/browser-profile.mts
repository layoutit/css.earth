import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/silvretta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'silvretta',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/silvretta/silvretta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/silvretta/silvretta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
