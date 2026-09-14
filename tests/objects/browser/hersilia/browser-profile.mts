import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hersilia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hersilia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hersilia/hersilia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hersilia/hersilia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
