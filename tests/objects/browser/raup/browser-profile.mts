import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/raup/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'raup',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/raup/raup-directional-sun.webp",
      "two": "/scenes/raup/raup-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/raup/raup-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/raup/raup-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
