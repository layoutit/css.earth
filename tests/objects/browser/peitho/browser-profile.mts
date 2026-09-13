import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/peitho/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'peitho',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/peitho/peitho-shape-surface@2x.webp",
    "/scenes/peitho/peitho-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/peitho/peitho-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
