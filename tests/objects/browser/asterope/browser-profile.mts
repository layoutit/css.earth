import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/asterope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asterope',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/asterope/asterope-shape-surface@2x.webp",
    "/scenes/asterope/asterope-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/asterope/asterope-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
