import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/philosophia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'philosophia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/philosophia/philosophia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/philosophia/philosophia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
