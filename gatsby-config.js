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
  ],
  flags: {
    /**
     * https://stackoverflow.com/questions/63066974/how-to-use-react-lazy-in-gatsby#comment125726318_63066975
     * https://github.com/gatsbyjs/gatsby/discussions/28138
     */
    DEV_SSR: true,
  },
};

module.exports = config;
