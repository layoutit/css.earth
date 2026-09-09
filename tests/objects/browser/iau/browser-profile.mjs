import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/iau/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iau',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/iau/iau-directional-sun.webp",
      "two": "/scenes/iau/iau-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/iau/iau-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/iau/iau-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
