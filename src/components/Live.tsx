import { useHydrated } from "@tanstack/react-router";
import { OnebaseProvider } from "onebase/react";
import type { ReactNode } from "react";
import { getClient } from "~/lib/onebase";

/** Anything that reads from the backend goes inside this. The server renders `fallback`; the
 *  browser connects once it has hydrated, so there is no socket on the server. */
export function Live({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <>{fallback}</>;
  return <OnebaseProvider client={getClient()}>{children}</OnebaseProvider>;
}
