import { Link } from "gatsby";
import React from "react";
import { css } from "@emotion/css";

import { siteTitle } from "projects/service/const";
import useSiteStore from "store/site.store";
import type { FrontMatterProps } from "./Root";
import Icon from "./Icon";

export default function NavItems({ frontmatter }: FrontMatterProps) {

  const groupedMetas = useSiteStore(x => x.groupedMetas);
  const tabIndex = useSiteStore(x => x.navOpen ? undefined : -1);

  return (
    <section className={rootCss}>

      <h3>
        <Link
          to="/"
          tabIndex={tabIndex}
        >
          {siteTitle}
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
                tabIndex={tabIndex}
              >
                {meta.label}
              </Link>
              
              <span>
                <Link
                  to={meta.path}
                  title={meta.info}
                  tabIndex={tabIndex}
                >
                  <NavIcon icon={meta?.icon} />
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
  border-bottom: 1px solid #777;
  
  h3 {
    letter-spacing: 2px;
    padding: 16px 12px;
    margin: 0;
    margin-left: 4px;

    font-family: 'Courier New', Courier, monospace;
    font-size: 1.4rem;
    font-weight: 300;

    a {
      color: #ddd;
    }
    border: 0 solid #444;
    border-width: 0 0 1px;
  }
  
  ul {
    font-size: 1.1rem;
    padding: 0;
    margin: 0;
    border: 0 solid #777;
    border-width: 1px 0 0 0;

    li {
      list-style: none;
      list-style-position: inside;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
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

function NavIcon({ icon }: { icon?: string }) {
  switch (icon) {
    case 'checked':
      return <Icon icon="checked" large className="ignore-dark" />;
    case 'road-works':
      return <Icon icon="road-works" large />;
    case 'info-icon':
      return <Icon icon="info-icon" large />;
    default:
      return <>{icon}</>; // Fallback assumes unicode
  }
}