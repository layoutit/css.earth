import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/klio/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'klio',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/klio/klio-shape-surface@2x.webp",
    "/scenes/klio/klio-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/klio/klio-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
