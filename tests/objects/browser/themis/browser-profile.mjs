import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/themis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'themis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/themis/themis-directional-sun.webp",
      "two": "/scenes/themis/themis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/themis/themis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/themis/themis-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
