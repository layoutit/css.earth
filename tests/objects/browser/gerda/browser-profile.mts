import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/gerda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gerda',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/gerda/gerda-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/gerda/gerda-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
