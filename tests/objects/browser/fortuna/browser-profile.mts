import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/fortuna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'fortuna',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/fortuna/fortuna-directional-sun.webp",
      "two": "/scenes/fortuna/fortuna-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/fortuna/fortuna-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/fortuna/fortuna-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
