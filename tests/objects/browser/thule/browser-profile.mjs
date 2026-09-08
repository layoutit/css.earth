import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/thule/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thule',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/thule/thule-directional-sun.webp",
      "two": "/scenes/thule/thule-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/thule/thule-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/thule/thule-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
