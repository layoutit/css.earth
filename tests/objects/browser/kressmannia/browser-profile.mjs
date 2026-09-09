import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/kressmannia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kressmannia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/kressmannia/kressmannia-directional-sun.webp",
      "two": "/scenes/kressmannia/kressmannia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/kressmannia/kressmannia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kressmannia/kressmannia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
