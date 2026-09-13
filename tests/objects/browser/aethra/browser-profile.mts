import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/aethra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aethra',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/aethra/aethra-shape-surface@2x.webp",
    "/scenes/aethra/aethra-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/aethra/aethra-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
