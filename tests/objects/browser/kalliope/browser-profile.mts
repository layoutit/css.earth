import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/kalliope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kalliope',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/kalliope/kalliope-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kalliope/kalliope-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
