import React from "react";
import { css, cx } from "@emotion/css";

export default function Def(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <div
      className={cx("def", rootCss)}
      title={props.title}
    >
      {props.children}
    </div>
  );
}

const rootCss = css`
  border-left: 8px solid var(--page-border-color);
  padding-left: 32px;
  @media (max-width: 600px) {
    padding-left: 16px;
  }
`;
