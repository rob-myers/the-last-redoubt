import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";
import { StaticQuery, graphql } from "gatsby";
import React from "react";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";
import { clearAllBodyScrollLocks } from "body-scroll-lock";

import useSiteStore, { AllFrontMatter, FrontMatter } from "store/site.store";
import { queryClient } from "projects/service/query-client";
import { siteTitle } from "projects/service/const";
import Nav from "./Nav";
import Main from "./Main";
import Portals from "./Portals";
import Article from "./Article";
import NextArticle from "./NextArticle";
import Comments from "./Comments";

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
        <title>
          {siteTitle}
        </title>
      </Helmet>

      <StaticQuery
        query={graphql`
          query { allMdx {
            edges { node { frontmatter {
              key
              date
              icon
              giscusTerm
              info
              label
              navGroup
              next
              path
              prev
              tags
            } } } }
          }
      `}
        render={(allFrontMatter: AllFrontMatter) => {

          React.useMemo(() => {
            clearAllBodyScrollLocks();
            useSiteStore.api.setArticleKey(frontMatter?.key);
            useSiteStore.api.initiate(allFrontMatter);
          }, [frontMatter]);
          
          React.useEffect(() => {
            useSiteStore.api.initiateBrowser();
          }, []);

          return (
            <QueryClientProvider client={queryClient} >
              <Nav frontmatter={frontMatter} />
              <Main>
                {frontMatter
                  ? <>
                      <Article frontmatter={frontMatter}>{element}</Article>
                      <NextArticle frontMatter={frontMatter}/>
                    </>
                  : element
                }
                <Comments
                  id="comments"
                  term={frontMatter?.giscusTerm || frontMatter?.path || 'fallback-discussion'}
                />
              </Main>
              <Portals />
              <ReactQueryDevtools // Performance issue after HMRs?
                initialIsOpen={false}
              />
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
