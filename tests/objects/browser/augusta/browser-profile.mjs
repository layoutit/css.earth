import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/augusta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'augusta',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/augusta/augusta-directional-sun.webp",
      "two": "/scenes/augusta/augusta-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/augusta/augusta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/augusta/augusta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
