import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/vindobona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vindobona',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/vindobona/vindobona-directional-sun.webp",
      "two": "/scenes/vindobona/vindobona-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/vindobona/vindobona-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/vindobona/vindobona-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
