import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/nysa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nysa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/nysa/nysa-directional-sun.webp",
      "two": "/scenes/nysa/nysa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/nysa/nysa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nysa/nysa-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
