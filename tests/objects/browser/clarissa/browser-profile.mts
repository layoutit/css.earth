import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/clarissa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'clarissa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/clarissa/clarissa-shape-surface@2x.webp",
    "/scenes/clarissa/clarissa-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/clarissa/clarissa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
