import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/urania/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'urania',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/urania/urania-shape-surface@2x.webp",
    "/scenes/urania/urania-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/urania/urania-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
