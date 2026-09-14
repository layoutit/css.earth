import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/athor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'athor',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/athor/athor-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/athor/athor-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
