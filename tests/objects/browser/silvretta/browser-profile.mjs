import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/silvretta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'silvretta',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/silvretta/silvretta-directional-sun.webp",
      "two": "/scenes/silvretta/silvretta-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/silvretta/silvretta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/silvretta/silvretta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
