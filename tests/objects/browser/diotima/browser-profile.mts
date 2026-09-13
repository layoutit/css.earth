import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/diotima/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'diotima',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/diotima/diotima-directional-sun.webp",
      "two": "/scenes/diotima/diotima-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/diotima/diotima-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/diotima/diotima-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
