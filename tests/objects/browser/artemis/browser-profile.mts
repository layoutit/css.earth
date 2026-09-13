import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/artemis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'artemis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/artemis/artemis-shape-surface@2x.webp",
    "/scenes/artemis/artemis-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/artemis/artemis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
