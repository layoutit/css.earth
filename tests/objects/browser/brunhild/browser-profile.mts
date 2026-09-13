import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/brunhild/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'brunhild',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/brunhild/brunhild-shape-surface@2x.webp",
    "/scenes/brunhild/brunhild-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/brunhild/brunhild-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
