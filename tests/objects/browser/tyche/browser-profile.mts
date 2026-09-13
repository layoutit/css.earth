import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/tyche/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tyche',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/tyche/tyche-shape-surface@2x.webp",
    "/scenes/tyche/tyche-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/tyche/tyche-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
