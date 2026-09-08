import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/leukothea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leukothea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/leukothea/leukothea-directional-sun.webp",
      "two": "/scenes/leukothea/leukothea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/leukothea/leukothea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/leukothea/leukothea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
