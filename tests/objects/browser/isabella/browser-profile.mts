import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/isabella/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'isabella',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/isabella/isabella-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/isabella/isabella-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
