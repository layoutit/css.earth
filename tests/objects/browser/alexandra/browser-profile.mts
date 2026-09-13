import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/alexandra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'alexandra',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/alexandra/alexandra-directional-sun.webp",
      "two": "/scenes/alexandra/alexandra-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/alexandra/alexandra-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/alexandra/alexandra-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
