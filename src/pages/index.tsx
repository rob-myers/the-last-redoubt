import * as React from "react"
import Article from "components/page/Article";
import HomepageMdx from "articles/homepage.mdx";

export default function IndexPage() {
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
