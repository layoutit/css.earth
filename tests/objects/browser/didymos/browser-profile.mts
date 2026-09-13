import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/didymos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'didymos',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/didymos/didymos-directional-sun.webp",
      "two": "/scenes/didymos/didymos-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/didymos/didymos-shape-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/didymos/didymos-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "shape",
      "draco",
      "elevation",
      "albedo"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
