import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/thisbe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thisbe',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/thisbe/thisbe-directional-sun.webp",
      "two": "/scenes/thisbe/thisbe-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/thisbe/thisbe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/thisbe/thisbe-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
