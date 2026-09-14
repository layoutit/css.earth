import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/europa-52/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'europa-52',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/europa-52/europa-52-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/europa-52/europa-52-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
