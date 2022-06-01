import * as React from "react"
import useSiteStore from "store/site.store";
import Article from "components/page/Article";
import HomepageMdx from "articles/homepage.mdx";

export default function IndexPage() {
  // TODO move elsewhere (used by Nav/NavMini)
  React.useEffect(() => useSiteStore.setState({ articleKey: 'homepage' }) ,[]);
  
  return (
    <Article
      articleKey="homepage"
      dateTime="2022-05-22"
      tags={['night land', 'web dev', 'game ai']}
    >
      <HomepageMdx />
    </Article>
  )
}
