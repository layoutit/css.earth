import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/lutetia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lutetia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lutetia/lutetia-directional-sun.webp",
      "two": "/scenes/lutetia/lutetia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lutetia/lutetia-shape-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/lutetia/lutetia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
