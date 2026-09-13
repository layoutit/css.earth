import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/thisbe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thisbe',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/thisbe/thisbe-shape-surface@2x.webp",
    "/scenes/thisbe/thisbe-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/thisbe/thisbe-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
