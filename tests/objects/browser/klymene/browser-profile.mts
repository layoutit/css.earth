import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/klymene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'klymene',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/klymene/klymene-shape-surface@2x.webp",
    "/scenes/klymene/klymene-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/klymene/klymene-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
