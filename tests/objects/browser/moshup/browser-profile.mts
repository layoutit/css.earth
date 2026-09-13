import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/moshup/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'moshup',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/moshup/moshup-shape-surface@2x.webp",
    "/scenes/moshup/moshup-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/moshup/moshup-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
