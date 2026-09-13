import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/parysatis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'parysatis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/parysatis/parysatis-shape-surface@2x.webp",
    "/scenes/parysatis/parysatis-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/parysatis/parysatis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
