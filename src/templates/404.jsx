import React from 'react';

/**
 * - This file should be JSX, because `path.resolve`d by gatsby-node.js.
 * - Didn't work when put inside src/components/page
 */
export default function NotFoundPage() {
  return <><b>404</b>: requested path not found.</>;
}
