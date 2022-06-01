import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";
import { StaticQuery, graphql } from "gatsby";
import React from "react";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import useSiteStore, { AllFrontmatter as AllFrontMatter, FrontMatter } from "store/site.store";
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
    props.pageResources?.json.pageContext?.frontmatter
  ) as FrontMatter | undefined;

  return (
    <>
      <Helmet>
        <title>The Last Redoubt</title>
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

          React.useEffect(() =>
            useSiteStore.api.initiate(allFrontMatter, frontMatter),
            [],
          );

          return <>
            {frontMatter &&
              <QueryClientProvider client={queryClient} >
                <Nav frontmatter={frontMatter} />
                <Main>
                  <Article frontmatter={frontMatter}>
                    {element}
                  </Article>
                  <NextArticle frontMatter={frontMatter}/>
                </Main>
                <Portals />
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            }
      
            {!frontMatter &&
              <Main>{element}</Main>
            }
          </>;
        }}
      />

    </>
  );
}

export interface FrontMatterProps {
  frontmatter: FrontMatter;
}
