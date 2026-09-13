import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/unitas/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'unitas',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/unitas/unitas-directional-sun.webp",
      "two": "/scenes/unitas/unitas-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/unitas/unitas-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/unitas/unitas-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
