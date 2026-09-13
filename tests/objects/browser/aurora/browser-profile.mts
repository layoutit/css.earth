import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/aurora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aurora',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/aurora/aurora-shape-surface@2x.webp",
    "/scenes/aurora/aurora-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/aurora/aurora-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
