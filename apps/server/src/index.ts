import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./db";
import { ensureStorageBucket } from "./services/storage";

async function start() {
  await prisma.$connect();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await ensureStorageBucket();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.log(`CBAI server listening on http://localhost:${config.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}; shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch(async (error) => {
  console.error("Server failed to start", error);
  await prisma.$disconnect();
  process.exit(1);
});
