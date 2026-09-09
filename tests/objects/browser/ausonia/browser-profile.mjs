import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/ausonia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ausonia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ausonia/ausonia-directional-sun.webp",
      "two": "/scenes/ausonia/ausonia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ausonia/ausonia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ausonia/ausonia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
