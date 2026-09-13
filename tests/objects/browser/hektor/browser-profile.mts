import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hektor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hektor',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hektor/hektor-shape-surface@2x.webp",
    "/scenes/hektor/hektor-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hektor/hektor-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
