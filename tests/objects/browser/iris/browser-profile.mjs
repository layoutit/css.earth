import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/iris/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iris',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/iris/iris-directional-sun.webp",
      "two": "/scenes/iris/iris-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/iris/iris-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/iris/iris-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
