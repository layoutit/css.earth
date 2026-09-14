import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-1998-ml14/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1998-ml14',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
