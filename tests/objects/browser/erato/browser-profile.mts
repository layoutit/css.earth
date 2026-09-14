import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/erato/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erato',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/erato/erato-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/erato/erato-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
