import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/dejopeja/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dejopeja',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/dejopeja/dejopeja-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dejopeja/dejopeja-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
