import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/tulipa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tulipa',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/tulipa/tulipa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/tulipa/tulipa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
