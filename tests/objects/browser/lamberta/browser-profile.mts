import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lamberta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lamberta',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lamberta/lamberta-directional-sun.webp",
      "two": "/scenes/lamberta/lamberta-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lamberta/lamberta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lamberta/lamberta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
