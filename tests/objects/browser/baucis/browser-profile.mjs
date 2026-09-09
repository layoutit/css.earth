import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/baucis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'baucis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/baucis/baucis-directional-sun.webp",
      "two": "/scenes/baucis/baucis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/baucis/baucis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/baucis/baucis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
