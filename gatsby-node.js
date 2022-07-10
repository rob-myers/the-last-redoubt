
/** @param {import('gatsby').CreateWebpackConfigArgs} opts */
exports.onCreateWebpackConfig = (opts) => {
 
  /** @type {import('webpack').Configuration} */
  const cfg = {
    module: {
      rules: [
        { test: /\/raw-loader.js$/, use: 'raw-loader' },
      ],
    },
    resolve: {
      fallback: {
        'util': false,
      },
    },
  };

  opts.actions.setWebpackConfig(cfg);

}