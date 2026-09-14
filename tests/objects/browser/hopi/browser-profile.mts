import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hopi/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hopi',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hopi/hopi-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hopi/hopi-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
