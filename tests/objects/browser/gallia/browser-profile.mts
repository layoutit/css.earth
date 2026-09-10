import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/gallia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gallia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/gallia/gallia-directional-sun.webp",
      "two": "/scenes/gallia/gallia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/gallia/gallia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/gallia/gallia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
