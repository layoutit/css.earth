import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-1994-cc/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1994-cc',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-1994-cc/asteroid-1994-cc-directional-sun.webp",
      "two": "/scenes/asteroid-1994-cc/asteroid-1994-cc-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1994-cc/asteroid-1994-cc-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1994-cc/asteroid-1994-cc-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
