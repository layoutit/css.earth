import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-1950-da/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1950-da',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1950-da/asteroid-1950-da-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1950-da/asteroid-1950-da-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
