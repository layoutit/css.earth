import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/pyrrhus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pyrrhus',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/pyrrhus/pyrrhus-shape-surface@2x.webp",
    "/scenes/pyrrhus/pyrrhus-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/pyrrhus/pyrrhus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
