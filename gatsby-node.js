
/** @param {import('gatsby').CreateWebpackConfigArgs} opts */
exports.onCreateWebpackConfig = (opts) => {
 
  /** @type {import('webpack').Configuration} */
  const cfg = {
    module: {
      rules: [
        { test: /\/raw-loader.js$/, use: 'raw-loader' },
        /**
         * Fixes `yarn build` error due to npm module `canvas`.
         * Only need `canvas` for scripts e.g. `yarn render-layout 301`.
         */
        { test: /\.node$/, use: 'null-loader' },
      ],
    },
    resolve: {
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