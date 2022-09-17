import React from "react";
import { css, cx } from "@emotion/css";
import Giscus from "@giscus/react";
import useSiteStore from "store/site.store";
import { discussionsUrl } from "projects/service/const";
import Icon from "./Icon";

export default function Comments(props: Props) {

  const { articleKey, darkMode, commentMeta } = useSiteStore(x => ({
    articleKey: x.articleKey,
    darkMode: x.darkMode,
    commentMeta: x.articleKey ? x.discussMeta[x.articleKey] : null,
  }), (a, b) => (
    a.articleKey === b.articleKey
    && a.darkMode === b.darkMode
    && a.commentMeta === b.commentMeta
  ));

  return (
    <section className={cx("comments", rootCss)}>

      <header>
        {commentMeta ? (
          <a
            href={commentMeta.url}
            target="_blank"
          >
            View discussion on GitHub
            &nbsp;<Icon icon="ext-link" inline small />
          </a>
        ) : (
          <>
            Comment below to start a&nbsp;
            <a
              href={discussionsUrl}
              target="_blank"
            >
              GitHub discussion
              {' '}<Icon icon="ext-link" inline small />
            </a>
          </>
        )}
      </header>

      {articleKey && (
        <Giscus
          id={props.id}
          repo="rob-myers/the-last-redoubt"
          repoId="R_kgDOHVYh5w"
          category="Announcements"
          categoryId="DIC_kwDOHVYh584CQ8vc"
          mapping="specific"
          term={articleKey}
          reactionsEnabled="1"
          // Emits message with data `{ giscus: { discussion, message } }` to window 
          emitMetadata="1"
          inputPosition="top"
          theme={darkMode ? 'dark' : 'light'}
          lang="en"
          loading="lazy"
        />
      )}
    </section>
  );
}

interface Props {
  id: string;
  term: string;
}

const rootCss = css`
  min-height: 322px;
  /* border-top: 1px solid var(--page-border-color); */
  padding: 16px 16px 16px 0;

  @media(max-width: 600px) {
    padding: 24px 8px 0 8px;
  }

  header {
    margin-bottom: 24px;
    > a {
      cursor: pointer;
      color: var(--page-link-color);
    }
  }

`;
