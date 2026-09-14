import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/daphne/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'daphne',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/daphne/daphne-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/daphne/daphne-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
