import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";
import { StaticQuery, graphql } from "gatsby";
import React from "react";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import useSiteStore, { AllFrontMatter, FrontMatter } from "store/site.store";
import { queryClient } from "projects/service/query-client";
import Nav from "./Nav";
import Main from "./Main";
import Portals from "./Portals";
import Article from "./Article";
import NextArticle from "./NextArticle";

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {

  const frontMatter = (
    props.pageContext?.frontmatter
  ) as FrontMatter | undefined;

  return (
    <>
      <Helmet>
        <title>The Last Redoubt</title>
        {/* <script>{`
  history.scrollRestoration = 'manual';
        `}</script> */}
      </Helmet>

      <StaticQuery
        query={graphql`
          query { allMdx {
            edges { node { frontmatter {
              key
              path
              info
              label
              date
              navGroup
              prev
              next
              tags
            } } } }
          }
      `}
        render={(allFrontMatter: AllFrontMatter) => {

          React.useMemo(() => {
            useSiteStore.api.initiate(allFrontMatter, frontMatter);
            setTimeout(() => {
              document.body.style.scrollBehavior = 'smooth';
              document.documentElement.style.scrollBehavior = 'smooth';
            }, 1000);
          }, [frontMatter]);

          // useBeforeunload(() =>
          //   tryLocalStorageSet(localStorageKey.windowScrollY, `${Math.round(window.scrollY)}`)
          // );

          return (
            <QueryClientProvider client={queryClient} >
              <Nav frontmatter={frontMatter} />
              <Main>
                {frontMatter && <>
                  <Article frontmatter={frontMatter}>
                    {element}
                  </Article>
                  <NextArticle frontMatter={frontMatter}/>
                </>}
                {!frontMatter && element}
              </Main>
              <Portals />
              <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
          );
        }}
      />

    </>
  );
}

export interface FrontMatterProps {
  frontmatter?: FrontMatter;
}
