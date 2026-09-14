import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/virtanen/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'virtanen',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/virtanen/virtanen-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/virtanen/virtanen-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
