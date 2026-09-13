import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/weringia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'weringia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/weringia/weringia-directional-sun.webp",
      "two": "/scenes/weringia/weringia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/weringia/weringia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/weringia/weringia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
