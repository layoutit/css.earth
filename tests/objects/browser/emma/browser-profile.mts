import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/emma/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'emma',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/emma/emma-directional-sun.webp",
      "two": "/scenes/emma/emma-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/emma/emma-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/emma/emma-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
