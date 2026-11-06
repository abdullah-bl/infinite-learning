import { OnebaseClient } from "onebase/browser";

let client: OnebaseClient | undefined;

/** One connection per tab, to the page's own origin: in production OneBase serves the page
 *  itself, and in dev the Vite proxy sends /api to it. VITE_ONEBASE_URL points it somewhere else. */
export function getClient() {
  return (client ??= new OnebaseClient(import.meta.env.VITE_ONEBASE_URL || undefined));
}
