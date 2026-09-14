import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hygiea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hygiea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hygiea/hygiea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hygiea/hygiea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
