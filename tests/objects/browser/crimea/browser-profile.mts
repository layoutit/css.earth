import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/crimea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'crimea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/crimea/crimea-directional-sun.webp",
      "two": "/scenes/crimea/crimea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/crimea/crimea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/crimea/crimea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
