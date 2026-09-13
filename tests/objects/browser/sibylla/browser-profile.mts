import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/sibylla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sibylla',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/sibylla/sibylla-directional-sun.webp",
      "two": "/scenes/sibylla/sibylla-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/sibylla/sibylla-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/sibylla/sibylla-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
