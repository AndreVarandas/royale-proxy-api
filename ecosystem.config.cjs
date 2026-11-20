/**
 * pm2 configuration (https://pm2.keymetrics.io/) for the Royale Proxy API.
 *
 * Run with: pm2 start ecosystem.config.cjs
 *
 * NOTE: keep this at a single instance (no cluster mode). Rate limiting and
 * response caching are in-memory, so multiple processes would not share state.
 */
module.exports = {
  apps: [
    {
      name: "royale-proxy-api",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
    },
  ],
};
