import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lyyli/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lyyli',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lyyli/lyyli-shape-surface@2x.webp",
    "/scenes/lyyli/lyyli-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/lyyli/lyyli-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
