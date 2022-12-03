const { createFilePath } = require(`gatsby-source-filesystem`)

/* eslint-disable @typescript-eslint/no-var-requires */
/** @param {import('gatsby').CreateWebpackConfigArgs} opts */
exports.onCreateWebpackConfig = (opts) => {

  console.log({ 'GATSBY STAGE': opts.stage });
 
  /** @type {import('webpack').Configuration} */
  const cfg = {
    module: {
      rules: [
        // { test: /\/raw-loader.js$/, use: 'raw-loader' },
        /**
         * Fixes `yarn build` error due to npm module `canvas`.
         * Only need `canvas` for scripts e.g. `yarn render-layout 301`.
         */
        { test: /\.node$/, use: 'null-loader' },
      ],
    },
    resolve: {
      alias: {
        'cheerio': false, // null-loader
      },
      fallback: {
        'fs': false,
        'path': false,
        'stream': false,
        'util': false,
      },
    },
  };

  opts.actions.setWebpackConfig(cfg);

}

/** @type {(args: import('gatsby').CreatePagesArgs) => Promise<void>} */
exports.createPages = async function ({ actions: { createPage }, reporter }) {

  /**
   * Cannot use /pages/404.tsx because allFrontmatter is not provided to it,
   * so we cannot show navigation.
   */
  reporter.info(`Creating page /404`);
  const NotFoundPageTemplate = require('path').resolve('src/templates/404.jsx');
  createPage({
    path: '/404',
    component: NotFoundPageTemplate,
  });

}

/**
 * @type {import('gatsby').GatsbyNode['onCreateNode']}
 */
 exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions

  if (node.internal.type === `Mdx`) {
    const value = createFilePath({ node, getNode })

    createNodeField({
      name: `slug`,
      node,
      value,
    })
  }
}
