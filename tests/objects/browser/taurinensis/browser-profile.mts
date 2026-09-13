import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/taurinensis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'taurinensis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/taurinensis/taurinensis-shape-surface@2x.webp",
    "/scenes/taurinensis/taurinensis-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/taurinensis/taurinensis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
