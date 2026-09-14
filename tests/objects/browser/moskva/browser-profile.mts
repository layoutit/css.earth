import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/moskva/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'moskva',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/moskva/moskva-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/moskva/moskva-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
