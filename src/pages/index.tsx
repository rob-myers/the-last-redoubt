import * as React from "react"
import Article from "components/page/Article";
import HomepageMdx from "articles/homepage.mdx";

export default function IndexPage() {
  return (
    <Article articleKey="homepage">
      <HomepageMdx />
    </Article>
  );
}
