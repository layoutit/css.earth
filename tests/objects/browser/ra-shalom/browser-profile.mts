import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ra-shalom/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ra-shalom',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/ra-shalom/ra-shalom-shape-surface@2x.webp",
    "/scenes/ra-shalom/ra-shalom-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/ra-shalom/ra-shalom-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
