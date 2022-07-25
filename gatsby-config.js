/**
 * NOTE gatsby-plugin-preact does not seem to
 * support typescript format config gatsby-config.ts
 */

/** @type {import('gatsby').GatsbyConfig} */
const config = {
  siteMetadata: {
    title: `the-last-redoubt`,
    siteUrl: `https://www.yourdomain.tld`
  },
  plugins: [
    "gatsby-plugin-emotion",
    "gatsby-plugin-mdx",
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        "name": "pages",
        "path": "./src/pages/"
      },
      //@ts-ignore
      __key: "pages"
    },
    "gatsby-plugin-tsconfig-paths",
    "gatsby-plugin-react-helmet",
    // "gatsby-plugin-preact",
    "gatsby-plugin-loadable-components-ssr",
  ],
};

module.exports = config;
