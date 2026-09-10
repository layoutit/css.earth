import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/urda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'urda',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/urda/urda-directional-sun.webp",
      "two": "/scenes/urda/urda-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/urda/urda-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/urda/urda-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
