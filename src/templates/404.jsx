import React from 'react';
import { css } from '@emotion/css';
import { useLocation } from '@reach/router';

/**
 * - This file should be JSX, because `path.resolve`d by gatsby-node.js.
 * - Didn't work when put inside src/components/page
 */
export default function NotFoundPage() {

  const location = useLocation();  

  return (
    <main className={rootCss}>
      <article>
        <p>
          Status 404 i.e. requested path was not found:
          <blockquote>
            {location.href}
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

  p {
    font-weight: 600;
  }
  blockquote {
    animation: fadeIn 3s;
    font-weight: 300;
    color: #444;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;
