import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/alkeste/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'alkeste',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/alkeste/alkeste-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/alkeste/alkeste-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
