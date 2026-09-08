import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/nereus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nereus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/nereus/nereus-directional-sun.webp",
      "two": "/scenes/nereus/nereus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/nereus/nereus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nereus/nereus-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
