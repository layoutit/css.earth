import { createObjectRuntime } from "../../../platform/object-runtime.mjs";
import { runtimeDefinition } from "./definition.mjs";

export const mountMoonClient = createObjectRuntime(runtimeDefinition);
