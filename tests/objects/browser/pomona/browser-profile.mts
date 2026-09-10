import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/pomona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pomona',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/pomona/pomona-directional-sun.webp",
      "two": "/scenes/pomona/pomona-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/pomona/pomona-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/pomona/pomona-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
