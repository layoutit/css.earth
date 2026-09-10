import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ariadne/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ariadne',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ariadne/ariadne-directional-sun.webp",
      "two": "/scenes/ariadne/ariadne-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ariadne/ariadne-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ariadne/ariadne-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
