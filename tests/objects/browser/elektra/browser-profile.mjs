import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/elektra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'elektra',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/elektra/elektra-directional-sun.webp",
      "two": "/scenes/elektra/elektra-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/elektra/elektra-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/elektra/elektra-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
