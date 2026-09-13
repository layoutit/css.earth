import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/menelaus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'menelaus',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/menelaus/menelaus-shape-surface@2x.webp",
    "/scenes/menelaus/menelaus-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/menelaus/menelaus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
