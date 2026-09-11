import source from "../../../../src/planets/uranus/prepared/runtime.json" with {type:"json"};
import {parsePreparedObjectRuntime} from '../../../../src/renderers/css/dist/index.js';
export const runtimeDefinition = parsePreparedObjectRuntime(source);
