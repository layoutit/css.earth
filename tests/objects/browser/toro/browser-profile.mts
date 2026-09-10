import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/toro/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'toro',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/toro/toro-directional-sun.webp",
      "two": "/scenes/toro/toro-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/toro/toro-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/toro/toro-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
