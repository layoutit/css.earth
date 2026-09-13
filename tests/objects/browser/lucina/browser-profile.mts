import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lucina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lucina',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lucina/lucina-shape-surface@2x.webp",
    "/scenes/lucina/lucina-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/lucina/lucina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
