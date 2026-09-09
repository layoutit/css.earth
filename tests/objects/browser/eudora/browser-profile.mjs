import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/eudora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eudora',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eudora/eudora-directional-sun.webp",
      "two": "/scenes/eudora/eudora-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eudora/eudora-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eudora/eudora-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
