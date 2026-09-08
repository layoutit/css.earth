import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hidalgo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hidalgo',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hidalgo/hidalgo-directional-sun.webp",
      "two": "/scenes/hidalgo/hidalgo-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hidalgo/hidalgo-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hidalgo/hidalgo-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
