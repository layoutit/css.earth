import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/johanna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'johanna',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/johanna/johanna-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/johanna/johanna-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
