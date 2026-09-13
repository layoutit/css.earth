import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/phocaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'phocaea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/phocaea/phocaea-shape-surface@2x.webp",
    "/scenes/phocaea/phocaea-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/phocaea/phocaea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
