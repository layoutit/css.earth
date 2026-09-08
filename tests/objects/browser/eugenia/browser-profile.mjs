import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/eugenia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eugenia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eugenia/eugenia-directional-sun.webp",
      "two": "/scenes/eugenia/eugenia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eugenia/eugenia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eugenia/eugenia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
