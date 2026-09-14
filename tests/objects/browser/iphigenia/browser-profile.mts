import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/iphigenia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iphigenia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/iphigenia/iphigenia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/iphigenia/iphigenia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
