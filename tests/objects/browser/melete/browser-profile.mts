import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/melete/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'melete',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/melete/melete-shape-surface@2x.webp",
    "/scenes/melete/melete-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/melete/melete-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
