import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/vibilia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'vibilia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/vibilia/vibilia-directional-sun.webp",
      "two": "/scenes/vibilia/vibilia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/vibilia/vibilia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/vibilia/vibilia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
