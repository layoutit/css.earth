import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/lutetia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lutetia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lutetia/lutetia-directional-sun.webp",
      "two": "/scenes/lutetia/lutetia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lutetia/lutetia-osiris-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "osiris",
    "slowId": "shape",
    "winnerId": "osiris",
    "slowAsset": "/scenes/lutetia/lutetia-shape-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "osiris",
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
