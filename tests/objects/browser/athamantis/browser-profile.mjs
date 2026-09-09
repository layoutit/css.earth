import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/athamantis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'athamantis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/athamantis/athamantis-directional-sun.webp",
      "two": "/scenes/athamantis/athamantis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/athamantis/athamantis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/athamantis/athamantis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
