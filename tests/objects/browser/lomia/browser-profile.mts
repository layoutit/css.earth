import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lomia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lomia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lomia/lomia-directional-sun.webp",
      "two": "/scenes/lomia/lomia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lomia/lomia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lomia/lomia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
