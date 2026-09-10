import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/china/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'china',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/china/china-directional-sun.webp",
      "two": "/scenes/china/china-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/china/china-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/china/china-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
