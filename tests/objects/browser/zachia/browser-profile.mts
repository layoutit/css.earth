import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/zachia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'zachia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/zachia/zachia-directional-sun.webp",
      "two": "/scenes/zachia/zachia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/zachia/zachia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/zachia/zachia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
