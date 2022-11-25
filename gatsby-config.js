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
        extensions: [`.mdx`, `.md`],
        mdxOptions: {
          remarkPlugins: [
            require(`remark-gfm`),
            require("remark-math"),
            // wrapESMPlugin("remark-math"),
          ],
          rehypePlugins: [
            // require("rehype-katex"), { strict: 'ignore' }
            wrapESMPlugin("rehype-katex"),
          ],
        },
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        "name": "pages",
        // "path": "./src/pages/",
        "path": `${__dirname}/src/pages`,
      },
      // __key: "pages"
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        "name": "snippets",
        "path": `${__dirname}/src/components/snippet`,
      },
      // __key: "snippets"
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

/** https://www.npmjs.com/package/gatsby-plugin-mdx#mdxOptions */
function wrapESMPlugin (name) {
  return function wrapESM(opts) {
    return async (...args) => {
      const mod = await import(name)
      const plugin = mod.default(opts)
      return plugin(...args)
    }
  }
}

module.exports = config;
