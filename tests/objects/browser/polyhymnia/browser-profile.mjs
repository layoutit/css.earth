import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/polyhymnia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polyhymnia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/polyhymnia/polyhymnia-directional-sun.webp",
      "two": "/scenes/polyhymnia/polyhymnia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/polyhymnia/polyhymnia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/polyhymnia/polyhymnia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
