import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/rhodope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'rhodope',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/rhodope/rhodope-shape-surface@2x.webp",
    "/scenes/rhodope/rhodope-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/rhodope/rhodope-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
