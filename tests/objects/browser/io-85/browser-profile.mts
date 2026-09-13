import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/io-85/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'io-85',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/io-85/io-85-directional-sun.webp",
      "two": "/scenes/io-85/io-85-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/io-85/io-85-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/io-85/io-85-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
