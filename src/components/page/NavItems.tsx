import { Link } from "gatsby";
import React from "react";
import { css } from "@emotion/css";

import type { FrontMatterProps } from "./Root";
import useSiteStore from "store/site.store";

export default function NavItems({ frontmatter }: FrontMatterProps) {

  const groupedMetas = useSiteStore(x => x.groupedMetas);

  return (
    <section className={rootCss}>

      <h3>
        <Link to="/">
          The Last Redoubt
        </Link>
      </h3>

      {groupedMetas.map((navItems, i) =>
        <ul key={i}>
          {navItems.map((meta) =>
            <li
              key={meta.key}
              className={meta.key === frontmatter?.key ? 'current' : undefined}
            >
              <Link
                to={meta.path}
                title={meta.info}
              >
                {meta.label}
              </Link>
              
              <span>
                <Link
                  to={meta.path}
                  title={meta.info}
                >
                  {meta?.icon}
              </Link>
              </span>
            </li>
          )}
        </ul>
      )}

    </section>
  );
}

const rootCss = css`
  padding: 0;
  color: #aaa;
  font-family: sans-serif;
  
  h3 {
    padding: 20px 12px;
    font-size: 1.4rem;
    font-weight: 300;
    margin: 0;
    a {
      color: #ddd;
    }
    border: 0 solid #444;
    border-width: 0 0 4px;
  }
  
  ul {
    font-size: 1.1rem;
    padding: 6px 0;
    margin: 0;
    border: 0 solid #777;
    border-width: 0 0 1px;

    li {
      list-style: none;
      list-style-position: inside;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }
    li.current {
      a {
        color: white;
      }
      background: var(--nav-selected-background);
    }
    a {
      padding: 10px 0;
      width: 100%;
      color: #ccc;
      &:hover {
        color: #fff;
      }
    }
  }
`;