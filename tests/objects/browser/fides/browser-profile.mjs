import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/fides/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'fides',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/fides/fides-directional-sun.webp",
      "two": "/scenes/fides/fides-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/fides/fides-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/fides/fides-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
