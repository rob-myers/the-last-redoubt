import React from "react";
import type { WrapPageElementBrowserArgs } from "gatsby";
import Main from "components/page/Main"
import Portals from "components/page/Portals";

export function wrapPageElement({ element, props }: WrapPageElementBrowserArgs) {
  return (
    <>
      <Main>
        {element}
      </Main>
      <Portals />
    </>
  );
}