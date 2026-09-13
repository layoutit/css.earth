import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/agenor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'agenor',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/agenor/agenor-shape-surface@2x.webp",
    "/scenes/agenor/agenor-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/agenor/agenor-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
