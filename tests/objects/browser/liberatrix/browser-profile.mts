import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/liberatrix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'liberatrix',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/liberatrix/liberatrix-directional-sun.webp",
      "two": "/scenes/liberatrix/liberatrix-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/liberatrix/liberatrix-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/liberatrix/liberatrix-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
