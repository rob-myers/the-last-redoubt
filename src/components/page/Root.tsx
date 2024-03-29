import type { WrapPageElementBrowserArgs, WrapPageElementNodeArgs } from "gatsby";
import { graphql, useStaticQuery } from "gatsby";
import React from "react";
import { Helmet } from "react-helmet";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { clearAllBodyScrollLocks } from "body-scroll-lock";

import useSiteStore, { AllFrontMatter, FrontMatter } from "store/site.store";
import { queryClient } from "projects/service/query-client";
import { siteTitle } from "projects/service/const";
import { supportsWebp } from "projects/service/dom";
import Nav from "./Nav";
import Main from "./Main";
import Article from "./Article";
import NextArticle from "./NextArticle";
import Comments from "./Comments";

const iconExt = supportsWebp ? 'webp' : 'png';

export function wrapPageElement({
  element,
  props,
}: WrapPageElementBrowserArgs | WrapPageElementNodeArgs) {

  const frontMatter = (
    props.pageContext?.frontmatter
  ) as FrontMatter | undefined;

  return (
    <>
      <RootHooks frontMatter={frontMatter} />

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
        <ReactQueryDevtools // Performance issue after HMRs?
          initialIsOpen={false}
        />
      </QueryClientProvider>

    </>
  );
}

export interface FrontMatterProps {
  frontmatter?: FrontMatter;
}

function RootHooks(props: {
  frontMatter?: FrontMatter;
}) {

  const allFrontMatter = useStaticQuery(graphql`
    query {
      allMdx {
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
        } } }
      }
      allFile( filter: { sourceInstanceName: { eq: "icons" } }) {
        iconFilenames: edges { node { relativePath } }
      }
    }
  `) as AllFrontMatter;

  // console.log({ allFrontMatter })

  React.useMemo(() => {
    clearAllBodyScrollLocks();
    useSiteStore.api.setArticleKey(props.frontMatter?.key);
    useSiteStore.api.initiate(allFrontMatter);
  }, [props.frontMatter]);

  const preloadedIconHrefs = React.useMemo(() =>
    allFrontMatter.allFile.iconFilenames
      .filter(({ node }) => node.relativePath.endsWith(iconExt))
      .map(({ node }) => `/assets/icon/${node.relativePath}`)
  , []);
  
  React.useEffect(() => {
    useSiteStore.api.initiateBrowser();
  }, []);

  return (
    <Helmet>
      <title>
        {siteTitle}
      </title>
      {preloadedIconHrefs.map((iconHref) =>
        // preload icons displayed via CSS background-image
        <link key={iconHref} rel="preload" as="image" href={iconHref} />
      )}
    </Helmet>
  );
}