import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ambrosia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ambrosia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ambrosia/ambrosia-directional-sun.webp",
      "two": "/scenes/ambrosia/ambrosia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ambrosia/ambrosia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ambrosia/ambrosia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
