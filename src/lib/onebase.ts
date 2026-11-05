import { OnebaseClient } from "onebase/browser";

let client: OnebaseClient | undefined;

/** One connection per tab, to the page's own origin: in production Caddy sends /api to the
 *  backend, and in dev the Vite proxy does. VITE_ONEBASE_URL points it somewhere else. */
export function getClient() {
  return (client ??= new OnebaseClient(import.meta.env.VITE_ONEBASE_URL || undefined));
}
