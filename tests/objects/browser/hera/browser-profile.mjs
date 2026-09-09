import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hera/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hera',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hera/hera-directional-sun.webp",
      "two": "/scenes/hera/hera-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hera/hera-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hera/hera-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
