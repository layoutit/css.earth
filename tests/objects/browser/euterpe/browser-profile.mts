import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/euterpe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'euterpe',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/euterpe/euterpe-shape-surface@2x.webp",
    "/scenes/euterpe/euterpe-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/euterpe/euterpe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
