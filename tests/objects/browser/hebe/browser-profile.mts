import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hebe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hebe',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hebe/hebe-shape-surface@2x.webp",
    "/scenes/hebe/hebe-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hebe/hebe-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
