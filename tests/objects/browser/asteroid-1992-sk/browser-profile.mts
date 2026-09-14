import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-1992-sk/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1992-sk',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1992-sk/asteroid-1992-sk-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1992-sk/asteroid-1992-sk-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
