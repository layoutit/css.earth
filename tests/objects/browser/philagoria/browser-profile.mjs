import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/philagoria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'philagoria',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/philagoria/philagoria-directional-sun.webp",
      "two": "/scenes/philagoria/philagoria-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/philagoria/philagoria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/philagoria/philagoria-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
