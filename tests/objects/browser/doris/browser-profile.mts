import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/doris/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'doris',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/doris/doris-directional-sun.webp",
      "two": "/scenes/doris/doris-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/doris/doris-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/doris/doris-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
