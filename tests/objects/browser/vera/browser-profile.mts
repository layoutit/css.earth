import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/vera/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vera',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/vera/vera-directional-sun.webp",
      "two": "/scenes/vera/vera-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/vera/vera-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/vera/vera-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
