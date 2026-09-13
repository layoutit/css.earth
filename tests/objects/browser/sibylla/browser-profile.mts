import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/sibylla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sibylla',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/sibylla/sibylla-shape-surface@2x.webp",
    "/scenes/sibylla/sibylla-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/sibylla/sibylla-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
