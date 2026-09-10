import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/demodokus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'demodokus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/demodokus/demodokus-directional-sun.webp",
      "two": "/scenes/demodokus/demodokus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/demodokus/demodokus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/demodokus/demodokus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
