import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/gyptis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gyptis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/gyptis/gyptis-shape-surface@2x.webp",
    "/scenes/gyptis/gyptis-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/gyptis/gyptis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
