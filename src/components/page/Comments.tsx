import React from "react";
import { css, cx } from "@emotion/css";
import Giscus from "@giscus/react";
import useSiteStore from "store/site.store";

export default function Comments(props: Props) {
  const darkMode = useSiteStore(x => x.darkMode);

  return (
    <div className={cx("comments", rootCss)}>
      <Giscus
        id={props.id}
        repo="rob-myers/the-last-redoubt"
        repoId="R_kgDOHVYh5w"
        category="Announcements"
        categoryId="DIC_kwDOHVYh584CQ8vc"
        mapping="specific"
        term={props.term}
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme={darkMode ? 'dark' : 'light'}
        lang="en"
        loading="lazy"
      />
    </div>
  );
}

interface Props {
  id: string;
  term: string;
}

const rootCss = css`
  min-height: 322px;
  border-top: 1px solid #eee;
  padding-top: 8px;
`;