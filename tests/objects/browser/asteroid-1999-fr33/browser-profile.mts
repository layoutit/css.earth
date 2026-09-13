import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/asteroid-1999-fr33/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1999-fr33',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-shape-surface@2x.webp",
    "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
