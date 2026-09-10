import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/ivar/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ivar',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ivar/ivar-directional-sun.webp",
      "two": "/scenes/ivar/ivar-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ivar/ivar-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ivar/ivar-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
