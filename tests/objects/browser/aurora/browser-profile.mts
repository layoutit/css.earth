import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/aurora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aurora',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/aurora/aurora-directional-sun.webp",
      "two": "/scenes/aurora/aurora-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/aurora/aurora-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/aurora/aurora-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
