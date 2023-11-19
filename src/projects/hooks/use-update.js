import React from "react";

/**
 * Provides a function to trigger an update.
 */
export default function useUpdate() {
  const [, set] = React.useState(() => 0);
  return () => set(x => x + 1);
}
