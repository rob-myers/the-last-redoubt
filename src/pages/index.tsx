import * as React from "react"
import Main from "components/page/Main"
import useSiteStore from "store/site.store";
import Article from "components/page/Article";
import ObjectiveMdx from "articles/objective.mdx";
import Portals from "components/page/Portals";

/**
 * TODO 🚧
 * - wrapper -> gatsby-ssr.js
 * - one article per page
 * - move to pages/objective.mdx
 * - index.tsx -> index.mdx and links to above
 * - articleKey provided via frontmatter
 * - remove articleMeta
 */

const IndexPage = () => {
  // TODO remove hack
  React.useEffect(() => useSiteStore.setState({ articleKey: 'objective' }) ,[]);
  
  return <>
    <Main>
      <Article
        articleKey="objective"
        dateTime="2022-05-22"
        tags={['foo', 'bar', 'baz']}
      >
        <ObjectiveMdx />
      </Article>
    </Main>
    <Portals />
  </>
}

export default IndexPage
