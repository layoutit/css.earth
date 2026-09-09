import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/laetitia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'laetitia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/laetitia/laetitia-directional-sun.webp",
      "two": "/scenes/laetitia/laetitia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/laetitia/laetitia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/laetitia/laetitia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
