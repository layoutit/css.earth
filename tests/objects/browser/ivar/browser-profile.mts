import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ivar/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ivar',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/ivar/ivar-shape-surface@2x.webp",
    "/scenes/ivar/ivar-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/ivar/ivar-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
