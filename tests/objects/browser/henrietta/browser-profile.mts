import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/henrietta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'henrietta',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/henrietta/henrietta-directional-sun.webp",
      "two": "/scenes/henrietta/henrietta-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/henrietta/henrietta-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/henrietta/henrietta-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
