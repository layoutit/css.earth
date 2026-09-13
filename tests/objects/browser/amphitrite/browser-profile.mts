import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/amphitrite/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'amphitrite',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/amphitrite/amphitrite-shape-surface@2x.webp",
    "/scenes/amphitrite/amphitrite-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/amphitrite/amphitrite-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
