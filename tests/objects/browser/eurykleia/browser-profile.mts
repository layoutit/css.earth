import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/eurykleia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eurykleia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eurykleia/eurykleia-shape-surface@2x.webp",
    "/scenes/eurykleia/eurykleia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/eurykleia/eurykleia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
