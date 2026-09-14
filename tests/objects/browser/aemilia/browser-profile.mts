import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/aemilia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aemilia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/aemilia/aemilia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/aemilia/aemilia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
