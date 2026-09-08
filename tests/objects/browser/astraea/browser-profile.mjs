import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/astraea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'astraea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/astraea/astraea-directional-sun.webp",
      "two": "/scenes/astraea/astraea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/astraea/astraea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/astraea/astraea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
