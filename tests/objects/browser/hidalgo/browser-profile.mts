import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hidalgo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hidalgo',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hidalgo/hidalgo-shape-surface@2x.webp",
    "/scenes/hidalgo/hidalgo-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hidalgo/hidalgo-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
