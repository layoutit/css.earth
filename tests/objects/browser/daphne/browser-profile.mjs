import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/daphne/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'daphne',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/daphne/daphne-directional-sun.webp",
      "two": "/scenes/daphne/daphne-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/daphne/daphne-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/daphne/daphne-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
