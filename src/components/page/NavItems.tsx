import React from "react";
import { css } from "@emotion/css";

// TODO infer navGroups elsewhere from all frontmatter
import { getArticleHref, navGroups } from "articles/index";
import type { FrontMatterProps } from "./Root";
import Link from './Link'

export default function NavItems({ frontmatter }: FrontMatterProps) {
  return (
    <section className={rootCss}>

      <h3>
        <Link href="/">
          The Last Redoubt
        </Link>
      </h3>

      {navGroups.map((navItems, i) =>
        <ul key={i}>
          {navItems.map((meta) =>
            <li key={meta.key} className={meta.key === frontmatter.key ? 'current' : undefined} >
              <Link
                href={getArticleHref(meta)}
                title={meta.info}
                // backward={!!part && meta.part < part}
              >
                {meta.index} {meta.label}
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
  
  h3 {
    padding: 20px 12px;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-size: 1.8rem;
    font-weight: 300;
    margin: 0;
    a {
      color: #ddd;
    }
    border: 0 solid #aaa;
    border-width: 0 0 2px;
  }
  
  ul {
    font-size: 1.1rem;
    padding: 6px 0;
    margin: 0;
    border: 0 solid #aaa;
    border-width: 0 0 2px;

    li {
      list-style: none;
      list-style-position: inside;
      display: flex;
    }
    li.current {
      a {
        color: white;
      }
    }
    a {
      padding: 10px 12px;
      width: 100%;
      color: #888;
      &:hover {
        color: #ccc;
      }
    }
  }
`;