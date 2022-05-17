import React from "react";
import type { WrapPageElementBrowserArgs } from "gatsby";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools'

import Nav from "components/page/Nav"
import Main from "components/page/Main"
import Portals from "components/page/Portals";
import { queryClient } from 'projects/service/query-client';

export function wrapPageElement({ element, props }: WrapPageElementBrowserArgs) {
  return (
    <>
      <Helmet>
        <title>
          The Last Redoubt
        </title>
      </Helmet>
      <QueryClientProvider client={queryClient} >
        <Nav />
        <Main>
          {element}
        </Main>
        <Portals />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </>
  );
}