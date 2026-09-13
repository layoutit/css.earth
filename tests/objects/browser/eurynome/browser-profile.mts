import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/eurynome/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eurynome',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eurynome/eurynome-shape-surface@2x.webp",
    "/scenes/eurynome/eurynome-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/eurynome/eurynome-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
