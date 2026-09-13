import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/diomedes/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'diomedes',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/diomedes/diomedes-shape-surface@2x.webp",
    "/scenes/diomedes/diomedes-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/diomedes/diomedes-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
