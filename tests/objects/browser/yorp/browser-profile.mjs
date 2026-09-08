import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/yorp/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'yorp',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/yorp/yorp-directional-sun.webp",
      "two": "/scenes/yorp/yorp-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/yorp/yorp-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/yorp/yorp-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
