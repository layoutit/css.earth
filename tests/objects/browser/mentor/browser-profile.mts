import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/mentor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mentor',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/mentor/mentor-shape-surface@2x.webp",
    "/scenes/mentor/mentor-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/mentor/mentor-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
