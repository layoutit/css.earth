import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/nemesis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nemesis',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/nemesis/nemesis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nemesis/nemesis-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
