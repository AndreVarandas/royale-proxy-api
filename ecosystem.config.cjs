/**
 * This file is used to configure pm2 (https://pm2.keymetrics.io/)
 * To run the Royale Proxy API server.
 *
 * As obvious as it seems, it specifies the name of the
 * server, the port it should run on, and the script to run.
 *
 * You probably don't need this file at all.
 */
module.exports = {
  apps: [
    {
      name: "royale-proxy-api",
      port: 3002,
      script: "./.output/server/index.mjs",
    },
  ],
};
