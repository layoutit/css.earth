import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/scylla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'scylla',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/scylla/scylla-shape-surface@2x.webp",
    "/scenes/scylla/scylla-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/scylla/scylla-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
