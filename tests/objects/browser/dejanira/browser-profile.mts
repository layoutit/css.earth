import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/dejanira/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dejanira',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/dejanira/dejanira-shape-surface@2x.webp",
    "/scenes/dejanira/dejanira-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/dejanira/dejanira-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
