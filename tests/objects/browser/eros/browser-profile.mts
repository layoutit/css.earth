import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eros/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eros',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eros/eros-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "infrared",
    "winnerId": "normal",
    "slowAsset": "/scenes/eros/eros-infrared-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "infrared",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
