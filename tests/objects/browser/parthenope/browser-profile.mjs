import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/parthenope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'parthenope',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/parthenope/parthenope-directional-sun.webp",
      "two": "/scenes/parthenope/parthenope-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/parthenope/parthenope-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/parthenope/parthenope-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
