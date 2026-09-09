import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/bellona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bellona',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bellona/bellona-directional-sun.webp",
      "two": "/scenes/bellona/bellona-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bellona/bellona-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/bellona/bellona-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
