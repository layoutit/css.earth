import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/musa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'musa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/musa/musa-directional-sun.webp",
      "two": "/scenes/musa/musa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/musa/musa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/musa/musa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
