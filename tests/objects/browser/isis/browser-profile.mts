import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/isis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'isis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/isis/isis-directional-sun.webp",
      "two": "/scenes/isis/isis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/isis/isis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/isis/isis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
