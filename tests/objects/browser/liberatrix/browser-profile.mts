import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/liberatrix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'liberatrix',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/liberatrix/liberatrix-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/liberatrix/liberatrix-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
