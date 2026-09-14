import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/lycomedes/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lycomedes',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lycomedes/lycomedes-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lycomedes/lycomedes-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
