import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/yorp/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'yorp',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/yorp/yorp-shape-surface@2x.webp",
    "/scenes/yorp/yorp-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/yorp/yorp-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
