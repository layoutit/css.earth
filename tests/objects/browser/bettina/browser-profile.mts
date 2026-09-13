import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/bettina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bettina',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/bettina/bettina-shape-surface@2x.webp",
    "/scenes/bettina/bettina-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/bettina/bettina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
