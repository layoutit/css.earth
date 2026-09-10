import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/schaber/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'schaber',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/schaber/schaber-directional-sun.webp",
      "two": "/scenes/schaber/schaber-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/schaber/schaber-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/schaber/schaber-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
