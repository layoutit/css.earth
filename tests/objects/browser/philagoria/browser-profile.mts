import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/philagoria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'philagoria',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/philagoria/philagoria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/philagoria/philagoria-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
