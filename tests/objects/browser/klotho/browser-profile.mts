import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/klotho/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'klotho',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/klotho/klotho-directional-sun.webp",
      "two": "/scenes/klotho/klotho-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/klotho/klotho-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/klotho/klotho-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
