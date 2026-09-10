import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/susi/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'susi',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/susi/susi-directional-sun.webp",
      "two": "/scenes/susi/susi-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/susi/susi-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/susi/susi-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
