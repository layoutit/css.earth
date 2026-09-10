import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/golevka/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'golevka',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/golevka/golevka-directional-sun.webp",
      "two": "/scenes/golevka/golevka-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/golevka/golevka-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/golevka/golevka-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
