import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/beatrix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'beatrix',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/beatrix/beatrix-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/beatrix/beatrix-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
