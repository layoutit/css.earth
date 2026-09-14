import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/huberta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'huberta',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/huberta/huberta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/huberta/huberta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
