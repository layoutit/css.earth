import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lilaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lilaea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lilaea/lilaea-directional-sun.webp",
      "two": "/scenes/lilaea/lilaea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lilaea/lilaea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lilaea/lilaea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
