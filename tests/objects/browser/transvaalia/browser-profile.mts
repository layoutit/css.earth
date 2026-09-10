import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/transvaalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'transvaalia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/transvaalia/transvaalia-directional-sun.webp",
      "two": "/scenes/transvaalia/transvaalia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/transvaalia/transvaalia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/transvaalia/transvaalia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
