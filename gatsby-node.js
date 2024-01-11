const { createFilePath } = require(`gatsby-source-filesystem`)

/* eslint-disable @typescript-eslint/no-var-requires */
/** @param {import('gatsby').CreateWebpackConfigArgs} opts */
exports.onCreateWebpackConfig = (opts) => {

  console.log({ 'GATSBY STAGE': opts.stage, NODE_ENV: process.env.NODE_ENV });
 
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

        // Force CommonJS for PixiJS
        // https://github.com/pixijs/pixi-react/issues/452
        'pixi.js': path.resolve(__dirname, 'node_modules/pixi.js/dist/cjs/pixi.min.js'),
        '@pixi/react': path.resolve(__dirname, `node_modules/@pixi/react/dist/index.cjs${process.env.NODE_ENV === 'production' ? '' : '-dev'}.js`),
        'pixi-viewport': path.resolve(__dirname, 'node_modules/pixi-viewport/dist/pixi_viewport.umd.cjs'),
        
      },
      fallback: {
        'child_process': false,
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

//#region page-data.json cache buster https://stackoverflow.com/a/58238793/2917822

const crypto = require('crypto')
const fs = require('fs')
const glob = require('glob') // 🚧 not explicitly in package.json
const path = require('path')
const util = require('util')

const hash = md5(`${new Date().getTime()}`)

exports.onPostBootstrap = async () => {
  const loader = path.join(__dirname, 'node_modules/gatsby/cache-dir/loader.js')
  await addPageDataVersion(loader)
}

exports.onPostBuild = async () => {
  const publicPath = path.join(__dirname, 'public')
  const htmlAndJSFiles = glob.sync(`${publicPath}/**/*.{html,js}`)
  for (let file of htmlAndJSFiles) {
    await addPageDataVersion(file)
  }
}

/** @param {string} filepath */
async function addPageDataVersion(filepath) {
  const stats = await util.promisify(fs.stat)(filepath)
  if (stats.isFile()) {
    console.log(`Adding version to page-data.json in ${filepath}...`)
    let content = await util.promisify(fs.readFile)(filepath, 'utf8')
    const result = content.replace(
      /page-data.json(\?v=[a-f0-9]{32})?/g,
      `page-data.json?v=${hash}`,
    ).replace(
      '/page-data/app-data.json',
      `/page-data/app-data.json?v=${hash}`,
    )
    await util.promisify(fs.writeFile)(filepath, result, 'utf8')
  }
}

/** @param {string} input */
function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex');
}
//#endregion