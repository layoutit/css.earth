import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/nuwa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nuwa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/nuwa/nuwa-shape-surface@2x.webp",
    "/scenes/nuwa/nuwa-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/nuwa/nuwa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
