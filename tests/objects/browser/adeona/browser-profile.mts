import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/adeona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'adeona',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/adeona/adeona-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/adeona/adeona-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
