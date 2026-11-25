import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False on the server and during hydration, true once the page's JavaScript runs. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
