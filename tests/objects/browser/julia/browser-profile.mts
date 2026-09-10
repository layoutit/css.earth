import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/julia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'julia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/julia/julia-directional-sun.webp",
      "two": "/scenes/julia/julia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/julia/julia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/julia/julia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
