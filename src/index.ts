import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig, loadEnvFile, type AppConfig } from "./env.js";
import { createLogger } from "./lib/logger.js";
import { version } from "./version.js";

function main(): void {
  loadEnvFile();

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const logger = createLogger(config.LOG_LEVEL);
  const app = createApp(config);
  const server = serve({ fetch: app.fetch, port: config.PORT, hostname: config.HOST }, (info) => {
    logger.info({ msg: "listening", version, address: info.address, port: info.port });
  });

  const shutdown = (signal: string) => {
    logger.info({ msg: "shutting down", signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
