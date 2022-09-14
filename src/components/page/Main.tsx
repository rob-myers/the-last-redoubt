import React from "react";
import { css } from "@emotion/css";
import Title from "./Title";

export default function Main({ children }: React.PropsWithChildren<{}>) {
  return (
    <section className={rootCss}>
      <Title />
      <main>
        {children}
      </main>
    </section>
  );
}

export const rootCss = css`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;

  color: var(--page-font-color);

  padding: 32px 0 32px 40px;
  margin: 0;
  @media(max-width: 600px) {
    padding: 0;
  }

  > main, > header {
    margin: 0 auto;
    width: 100%;
    max-width: 1024px;
  }
`;
