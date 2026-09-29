// Extends app.json. BASE_PATH is set by the GitHub Pages workflow to "/<repo-name>".
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.BASE_PATH ? { baseUrl: process.env.BASE_PATH } : null),
  },
});
