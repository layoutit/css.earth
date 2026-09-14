import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/nausikaa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nausikaa',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/nausikaa/nausikaa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nausikaa/nausikaa-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
