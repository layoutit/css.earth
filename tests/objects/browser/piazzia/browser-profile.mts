import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/piazzia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'piazzia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/piazzia/piazzia-directional-sun.webp",
      "two": "/scenes/piazzia/piazzia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/piazzia/piazzia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/piazzia/piazzia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
