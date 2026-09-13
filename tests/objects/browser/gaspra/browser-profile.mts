import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/gaspra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gaspra',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/gaspra/gaspra-normal-surface@2x.webp",
    "/scenes/gaspra/gaspra-directional-sun@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "calibrated",
    "winnerId": "normal",
    "slowAsset": "/scenes/gaspra/gaspra-calibrated-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "elevation",
      "calibrated"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
