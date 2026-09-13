import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/dike/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dike',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dike/dike-directional-sun.webp",
      "two": "/scenes/dike/dike-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dike/dike-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dike/dike-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
