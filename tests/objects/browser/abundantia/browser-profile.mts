import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/abundantia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'abundantia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/abundantia/abundantia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/abundantia/abundantia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
