import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/melpomene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'melpomene',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/melpomene/melpomene-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/melpomene/melpomene-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
