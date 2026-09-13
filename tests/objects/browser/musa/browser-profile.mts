import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/musa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'musa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/musa/musa-shape-surface@2x.webp",
    "/scenes/musa/musa-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/musa/musa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
