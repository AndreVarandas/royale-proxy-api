import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/** Single source of truth for the app version: package.json. */
export const version: string = pkg.version;
