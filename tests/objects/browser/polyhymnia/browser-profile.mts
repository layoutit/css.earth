import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/polyhymnia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polyhymnia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/polyhymnia/polyhymnia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/polyhymnia/polyhymnia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
