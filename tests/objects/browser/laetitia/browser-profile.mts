import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/laetitia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'laetitia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/laetitia/laetitia-shape-surface@2x.webp",
    "/scenes/laetitia/laetitia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/laetitia/laetitia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
