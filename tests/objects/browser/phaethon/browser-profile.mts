import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/phaethon/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'phaethon',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/phaethon/phaethon-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/phaethon/phaethon-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
