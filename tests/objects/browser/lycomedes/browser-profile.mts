import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lycomedes/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lycomedes',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lycomedes/lycomedes-directional-sun.webp",
      "two": "/scenes/lycomedes/lycomedes-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lycomedes/lycomedes-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lycomedes/lycomedes-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
