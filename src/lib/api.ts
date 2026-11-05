import { anyApi } from "onebase/browser";
import type { api as Api } from "../../onebase/_generated/api";

// The generated `api` module imports the server runtime, which can't load in a browser. The
// browser's `anyApi` is the same object of function names, so use it and keep only the types.
export const api = anyApi as unknown as typeof Api;
