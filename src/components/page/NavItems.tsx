import { Link } from "gatsby";
import React from "react";
import { css, cx } from "@emotion/css";

import { siteTitle } from "projects/service/const";
import useSiteStore from "store/site.store";
import type { FrontMatterProps } from "./Root";
import Icon from "./Icon";

export default function NavItems({ frontmatter }: FrontMatterProps) {

  const groupedMetas = useSiteStore(x => x.groupedMetas);
  const tabIndex = useSiteStore(x => x.navOpen ? undefined : -1);

  return (
    <section
      className={rootCss}
      onKeyUp={onKeyUp}
    >

      <h3 className={cx({ current: frontmatter?.key === 'index' })}>
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
              className={cx({ current: meta.key === frontmatter?.key })}
            >
              <Link
                to={meta.path}
                title={meta.info}
                tabIndex={tabIndex}
              >
                {meta.label}
                <NavIcon icon={meta?.icon} />
              </Link>
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
    display: flex;
    letter-spacing: 2px;
    margin: 0;
    margin-left: 4px;

    font-family: 'Courier New', Courier, monospace;
    font-size: 1.4rem;
    font-weight: 300;

    a {
      color: #ddd;
      width: 100%;
      padding: 16px 12px;
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
    }
    a {
      display: flex;
      align-items: center;
      justify-content: space-between;

      padding: 18px 16px;
      width: 100%;
      color: #ccc;
      &:hover {
        color: #fff;
      }
    }
  }

  h3.current, ul li.current {
    a {
      color: white;
    }
    background: var(--nav-selected-background);
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

function onKeyUp(e: React.KeyboardEvent) {
  if (e.key === 'Escape') {
    useSiteStore.setState({ navOpen: false }, undefined, 'close-nav');
    (e.target as HTMLElement).blur();
  }
}