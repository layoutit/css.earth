import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/elpis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'elpis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/elpis/elpis-directional-sun.webp",
      "two": "/scenes/elpis/elpis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/elpis/elpis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/elpis/elpis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
