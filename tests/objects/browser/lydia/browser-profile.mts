import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/lydia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lydia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lydia/lydia-directional-sun.webp",
      "two": "/scenes/lydia/lydia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lydia/lydia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lydia/lydia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
