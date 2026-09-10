import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/xanthippe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'xanthippe',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/xanthippe/xanthippe-directional-sun.webp",
      "two": "/scenes/xanthippe/xanthippe-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/xanthippe/xanthippe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/xanthippe/xanthippe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
