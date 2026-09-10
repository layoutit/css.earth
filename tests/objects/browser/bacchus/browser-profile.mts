import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/bacchus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bacchus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bacchus/bacchus-directional-sun.webp",
      "two": "/scenes/bacchus/bacchus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bacchus/bacchus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/bacchus/bacchus-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
