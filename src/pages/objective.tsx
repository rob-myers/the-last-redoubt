import * as React from "react"
import Article from "components/page/Article";
import ObjectiveMdx from "articles/objective.mdx";

/**
 * TODO 🚧
 * - ✅ wrapper -> gatsby-{browser,ssr}.js
 * - ✅ one article per page (centered)
 * - ✅ move to pages/objective.mdx
 * - ✅ index.tsx -> index.mdx and links to above
 * - ✅ start using frontmatter
 * - ✅ infer date and tags via frontmatter lookup
 * - ✅ fix link in homepage.mdx
 * - remove articleMeta
 */

export default function ObjectivePage() {
  return (
    <Article articleKey="objective">
      <ObjectiveMdx />
    </Article>
  );
}
