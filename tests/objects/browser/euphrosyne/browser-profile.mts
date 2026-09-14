import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/euphrosyne/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'euphrosyne',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/euphrosyne/euphrosyne-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/euphrosyne/euphrosyne-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
