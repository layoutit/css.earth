import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/atalante/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'atalante',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/atalante/atalante-directional-sun.webp",
      "two": "/scenes/atalante/atalante-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/atalante/atalante-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/atalante/atalante-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
