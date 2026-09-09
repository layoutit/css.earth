import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/dejopeja/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dejopeja',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dejopeja/dejopeja-directional-sun.webp",
      "two": "/scenes/dejopeja/dejopeja-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dejopeja/dejopeja-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dejopeja/dejopeja-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
