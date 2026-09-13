import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hestia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hestia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hestia/hestia-shape-surface@2x.webp",
    "/scenes/hestia/hestia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hestia/hestia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
