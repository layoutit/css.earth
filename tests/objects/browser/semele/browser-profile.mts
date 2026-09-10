import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/semele/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'semele',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/semele/semele-directional-sun.webp",
      "two": "/scenes/semele/semele-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/semele/semele-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/semele/semele-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
