import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/massalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'massalia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/massalia/massalia-shape-surface@2x.webp",
    "/scenes/massalia/massalia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/massalia/massalia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
