import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/asteroid-1996-hw1/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1996-hw1',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-1996-hw1/asteroid-1996-hw1-directional-sun.webp",
      "two": "/scenes/asteroid-1996-hw1/asteroid-1996-hw1-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1996-hw1/asteroid-1996-hw1-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1996-hw1/asteroid-1996-hw1-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
