import React from "react";
import { css } from "@emotion/css";
import useSiteStore, { FrontMatter } from "store/site.store";
import Link from "./Link";

export default function NextArticle({ frontMatter }: Props) {
  const id = `next-article--${frontMatter.key}`;
  const nextPath = useSiteStore(x =>
    (x.articlesMeta?.[frontMatter.next || '']?.path)??null
  );

  return nextPath ? (
    <div className={nextArticleCss}>
      <Link
        href={nextPath}
        title="Continue to next article"
        id={id}
        prePush={`#${id}`}
      >
        Next
      </Link>
    </div>
  ) : null;
}

interface Props {
  frontMatter: FrontMatter;
}

const nextArticleCss = css`
  height: 64px;
  font-size: 1.1rem;
  margin-top: -64px;
  @media(max-width: 800px) {
    margin-top: 0;
    font-size: 1rem;
  }

  display: flex;
  justify-content: center;
  align-items: center;

  a {
    color: #555;
    border: 1px solid #666;
    background: #fff;
    padding: 8px 16px;
    border-radius: 4px;
  }
`;
