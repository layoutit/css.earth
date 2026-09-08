import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/juewa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juewa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/juewa/juewa-directional-sun.webp",
      "two": "/scenes/juewa/juewa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/juewa/juewa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/juewa/juewa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
