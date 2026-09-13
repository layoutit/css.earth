import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/sophrosyne/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sophrosyne',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/sophrosyne/sophrosyne-directional-sun.webp",
      "two": "/scenes/sophrosyne/sophrosyne-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/sophrosyne/sophrosyne-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/sophrosyne/sophrosyne-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
