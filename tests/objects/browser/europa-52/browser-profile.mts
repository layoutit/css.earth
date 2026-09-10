import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/europa-52/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'europa-52',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/europa-52/europa-52-directional-sun.webp",
      "two": "/scenes/europa-52/europa-52-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/europa-52/europa-52-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/europa-52/europa-52-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
