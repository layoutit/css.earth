import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/galatea-74/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'galatea-74',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/galatea-74/galatea-74-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/galatea-74/galatea-74-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
