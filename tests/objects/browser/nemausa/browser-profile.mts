import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/nemausa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nemausa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/nemausa/nemausa-directional-sun.webp",
      "two": "/scenes/nemausa/nemausa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/nemausa/nemausa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nemausa/nemausa-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
