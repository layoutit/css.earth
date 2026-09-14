import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/reinmuthia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'reinmuthia',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/reinmuthia/reinmuthia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/reinmuthia/reinmuthia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
