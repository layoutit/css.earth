import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/vanadis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vanadis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/vanadis/vanadis-directional-sun.webp",
      "two": "/scenes/vanadis/vanadis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/vanadis/vanadis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/vanadis/vanadis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
