import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/tantalus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tantalus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/tantalus/tantalus-directional-sun.webp",
      "two": "/scenes/tantalus/tantalus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/tantalus/tantalus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/tantalus/tantalus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
