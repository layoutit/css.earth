import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/iclea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iclea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/iclea/iclea-directional-sun.webp",
      "two": "/scenes/iclea/iclea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/iclea/iclea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/iclea/iclea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
