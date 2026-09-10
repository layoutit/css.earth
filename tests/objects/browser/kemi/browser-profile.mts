import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/kemi/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kemi',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/kemi/kemi-directional-sun.webp",
      "two": "/scenes/kemi/kemi-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/kemi/kemi-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kemi/kemi-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
