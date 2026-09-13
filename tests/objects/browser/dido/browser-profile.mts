import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/dido/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dido',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dido/dido-directional-sun.webp",
      "two": "/scenes/dido/dido-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dido/dido-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dido/dido-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
