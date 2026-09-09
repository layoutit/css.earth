import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/una/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'una',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/una/una-directional-sun.webp",
      "two": "/scenes/una/una-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/una/una-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/una/una-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
