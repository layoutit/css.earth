import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/tulipa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tulipa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/tulipa/tulipa-directional-sun.webp",
      "two": "/scenes/tulipa/tulipa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/tulipa/tulipa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/tulipa/tulipa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
