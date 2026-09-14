import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/apophis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'apophis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/apophis/apophis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/apophis/apophis-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
