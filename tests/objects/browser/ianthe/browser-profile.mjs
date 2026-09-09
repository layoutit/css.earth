import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/ianthe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ianthe',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ianthe/ianthe-directional-sun.webp",
      "two": "/scenes/ianthe/ianthe-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ianthe/ianthe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ianthe/ianthe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
