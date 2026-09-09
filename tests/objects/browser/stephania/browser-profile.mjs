import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/stephania/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'stephania',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/stephania/stephania-directional-sun.webp",
      "two": "/scenes/stephania/stephania-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/stephania/stephania-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/stephania/stephania-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
