import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hela/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hela',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hela/hela-directional-sun.webp",
      "two": "/scenes/hela/hela-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hela/hela-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hela/hela-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
