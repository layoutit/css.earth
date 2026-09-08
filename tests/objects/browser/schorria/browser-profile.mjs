import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/schorria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'schorria',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/schorria/schorria-directional-sun.webp",
      "two": "/scenes/schorria/schorria-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/schorria/schorria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/schorria/schorria-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
