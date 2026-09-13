import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/tartaglia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tartaglia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/tartaglia/tartaglia-shape-surface@2x.webp",
    "/scenes/tartaglia/tartaglia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/tartaglia/tartaglia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
