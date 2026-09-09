import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/alkeste/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'alkeste',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/alkeste/alkeste-directional-sun.webp",
      "two": "/scenes/alkeste/alkeste-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/alkeste/alkeste-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/alkeste/alkeste-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
