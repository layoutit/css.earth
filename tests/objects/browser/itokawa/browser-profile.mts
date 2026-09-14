import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/itokawa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'itokawa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/itokawa/itokawa-amica-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "amica",
    "slowId": "elevation",
    "winnerId": "amica",
    "slowAsset": "/scenes/itokawa/itokawa-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "amica",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
