import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/beatrix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'beatrix',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/beatrix/beatrix-directional-sun.webp",
      "two": "/scenes/beatrix/beatrix-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/beatrix/beatrix-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/beatrix/beatrix-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
