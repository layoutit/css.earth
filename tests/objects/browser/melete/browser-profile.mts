import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/melete/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'melete',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/melete/melete-directional-sun.webp",
      "two": "/scenes/melete/melete-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/melete/melete-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/melete/melete-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
