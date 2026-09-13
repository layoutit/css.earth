import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/adelheid/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'adelheid',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/adelheid/adelheid-shape-surface@2x.webp",
    "/scenes/adelheid/adelheid-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/adelheid/adelheid-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
