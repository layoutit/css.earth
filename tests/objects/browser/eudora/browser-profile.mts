import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eudora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eudora',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eudora/eudora-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eudora/eudora-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
