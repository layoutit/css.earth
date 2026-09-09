import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/medusa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'medusa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/medusa/medusa-directional-sun.webp",
      "two": "/scenes/medusa/medusa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/medusa/medusa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/medusa/medusa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
