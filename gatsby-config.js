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
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        remarkPlugins: [require("remark-math")],
        rehypePlugins: [require("rehype-katex")],
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        "name": "pages",
        "path": "./src/pages/"
      },
      __key: "pages"
    },
    "gatsby-plugin-tsconfig-paths",
    "gatsby-plugin-react-helmet",
    // "gatsby-plugin-preact",
    "gatsby-plugin-loadable-components-ssr",
    {
      resolve: "gatsby-plugin-gatsby-cloud",
      options: {
        headers: {
          '/*': ['Cache-Control: public, max-age=31536000, immutable'],
          'static/*': ['Cache-Control: public, max-age=31536000, immutable'],
        },
      },
    }
  ],
  flags: {
    /**
     * Turning off because seeing spurious SSR errors:
     * - mvdan-sh
     * - svg-path-parser
     * 
     * https://stackoverflow.com/questions/63066974/how-to-use-react-lazy-in-gatsby#comment125726318_63066975
     * https://github.com/gatsbyjs/gatsby/discussions/28138
     */
    // DEV_SSR: true,
    FAST_DEV: true,
  },
};

module.exports = config;
