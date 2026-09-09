import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/eleonora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eleonora',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eleonora/eleonora-directional-sun.webp",
      "two": "/scenes/eleonora/eleonora-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eleonora/eleonora-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eleonora/eleonora-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
