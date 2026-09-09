import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/dione-106/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dione-106',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dione-106/dione-106-directional-sun.webp",
      "two": "/scenes/dione-106/dione-106-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dione-106/dione-106-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dione-106/dione-106-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
