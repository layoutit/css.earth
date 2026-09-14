import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/althaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'althaea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/althaea/althaea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/althaea/althaea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
