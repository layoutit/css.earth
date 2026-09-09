import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/echo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'echo',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/echo/echo-directional-sun.webp",
      "two": "/scenes/echo/echo-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/echo/echo-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/echo/echo-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
