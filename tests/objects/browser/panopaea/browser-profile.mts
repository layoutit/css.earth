import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/panopaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'panopaea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/panopaea/panopaea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/panopaea/panopaea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
