import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hertha/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hertha',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hertha/hertha-directional-sun.webp",
      "two": "/scenes/hertha/hertha-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hertha/hertha-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hertha/hertha-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
