import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/menippe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'menippe',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/menippe/menippe-directional-sun.webp",
      "two": "/scenes/menippe/menippe-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/menippe/menippe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/menippe/menippe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
