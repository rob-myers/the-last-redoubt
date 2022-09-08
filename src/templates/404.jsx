import React from 'react';
import { css } from '@emotion/css';

/**
 * - This file should be JSX, because `path.resolve`d by gatsby-node.js.
 * - Didn't work when put inside src/components/page
 */
export default function NotFoundPage() {
  return (
    <main className={rootCss}>
      <article>
        <p>
          Status <b>404</b>: requested path not found:
          <blockquote>
            {typeof window === 'undefined' ? '' : window.location.pathname}
          </blockquote>
        </p>
      </article>
    </main>
  );
}

const rootCss = css`
  margin: 32px 0;
  @media (max-width: 600px) {
    margin: 32px 8px;
  }

  blockquote {
    animation: fadeIn 1s;
    font-weight: 300;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;
