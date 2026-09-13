import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/metis-9/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'metis-9',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/metis-9/metis-9-directional-sun.webp",
      "two": "/scenes/metis-9/metis-9-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/metis-9/metis-9-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/metis-9/metis-9-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
