import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/angelina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'angelina',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/angelina/angelina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/angelina/angelina-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
