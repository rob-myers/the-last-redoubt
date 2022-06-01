import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";
import { StaticQuery, graphql } from 'gatsby';
import React from "react";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools'

import { queryClient } from "projects/service/query-client";
import Nav from "./Nav"
import Main from "./Main"
import Portals from "./Portals";
import Article from "./Article";

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {

  const frontmatter = (
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
              date
              tags
            } } } }
          }
        `}
        render={(allFrontmatter: AllFrontmatter) => {

          console.log({ allFrontmatter })

          return <>
            {frontmatter &&
              <QueryClientProvider client={queryClient} >
                <Nav frontmatter={frontmatter} />
                <Main>
                  <Article frontmatter={frontmatter}>
                    {element}
                  </Article>
                </Main>
                <Portals />
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            }
      
            {!frontmatter &&
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

export interface FrontMatter {
  key: string;
  path: string;
  info: string;
  date: string;
  prev: null | string;
  next: null | string;
  tags: string[];
}

interface AllFrontmatter {
  allMdx: {
    edges: {
      node: {
        /** Values are technically possibly null */
        frontmatter: {
          key: string;
          date: string;
          tags: string[];
        };
      };
    }[];
  };
}
