import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/maja/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'maja',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/maja/maja-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/maja/maja-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
