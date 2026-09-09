import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/huberta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'huberta',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/huberta/huberta-directional-sun.webp",
      "two": "/scenes/huberta/huberta-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/huberta/huberta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/huberta/huberta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
