import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/asteroid-1994-cc/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1994-cc',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1994-cc/asteroid-1994-cc-shape-surface@2x.webp",
    "/scenes/asteroid-1994-cc/asteroid-1994-cc-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1994-cc/asteroid-1994-cc-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
