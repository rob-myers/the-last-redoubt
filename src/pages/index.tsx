import * as React from "react"
import useSiteStore from "store/site.store";
import Article from "components/page/Article";
import ObjectiveMdx from "articles/objective.mdx";

/**
 * TODO 🚧
 * - ✅ wrapper -> gatsby-{browser,ssr}.js
 * - one article per page
 * - move to pages/objective.mdx
 * - index.tsx -> index.mdx and links to above
 * - articleKey provided via frontmatter
 * - remove articleMeta
 */

const IndexPage = () => {
  // TODO move elsewhere (used by Nav/NavMini)
  React.useEffect(() => useSiteStore.setState({ articleKey: 'objective' }) ,[]);
  
  return (
    <Article
      articleKey="objective"
      dateTime="2022-05-22"
      tags={['night land', 'web dev', 'shell', 'geomorph']}
    >
      <ObjectiveMdx />
    </Article>
  )
}

export default IndexPage
