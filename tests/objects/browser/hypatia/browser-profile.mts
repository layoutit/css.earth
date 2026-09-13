import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hypatia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hypatia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/hypatia/hypatia-shape-surface@2x.webp",
    "/scenes/hypatia/hypatia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/hypatia/hypatia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
