import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hesperia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hesperia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hesperia/hesperia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hesperia/hesperia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
