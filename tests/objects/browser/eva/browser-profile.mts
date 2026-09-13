import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/eva/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eva',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eva/eva-shape-surface@2x.webp",
    "/scenes/eva/eva-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/eva/eva-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
