import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hekate/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hekate',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hekate/hekate-shape-surface@2x.webp",
    "/scenes/hekate/hekate-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hekate/hekate-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
