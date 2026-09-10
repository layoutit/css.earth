import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/mr-spock/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mr-spock',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/mr-spock/mr-spock-directional-sun.webp",
      "two": "/scenes/mr-spock/mr-spock-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/mr-spock/mr-spock-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/mr-spock/mr-spock-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
