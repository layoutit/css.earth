import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/athor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'athor',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/athor/athor-directional-sun.webp",
      "two": "/scenes/athor/athor-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/athor/athor-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/athor/athor-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
