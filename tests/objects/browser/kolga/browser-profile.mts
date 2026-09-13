import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/kolga/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kolga',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/kolga/kolga-shape-surface@2x.webp",
    "/scenes/kolga/kolga-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/kolga/kolga-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
