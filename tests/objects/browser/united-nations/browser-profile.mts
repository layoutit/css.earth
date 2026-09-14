import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/united-nations/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'united-nations',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/united-nations/united-nations-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/united-nations/united-nations-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
