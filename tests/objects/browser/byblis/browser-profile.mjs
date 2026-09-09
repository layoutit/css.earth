import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/byblis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'byblis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/byblis/byblis-directional-sun.webp",
      "two": "/scenes/byblis/byblis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/byblis/byblis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/byblis/byblis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
