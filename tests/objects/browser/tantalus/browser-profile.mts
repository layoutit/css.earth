import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/tantalus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tantalus',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/tantalus/tantalus-shape-surface@2x.webp",
    "/scenes/tantalus/tantalus-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/tantalus/tantalus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
