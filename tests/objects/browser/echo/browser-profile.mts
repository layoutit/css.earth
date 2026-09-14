import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/echo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'echo',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/echo/echo-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/echo/echo-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
