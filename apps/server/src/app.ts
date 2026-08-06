import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import authRoutes from "./routes/auth";
import caseRoutes from "./routes/cases";
import imageRoutes from "./routes/images";
import analysisRoutes from "./routes/analyses";
import settingsRoutes from "./routes/settings";
import auditRoutes from "./routes/audit";
import userRoutes from "./routes/users";
import { config } from "./config";
import { prisma } from "./db";
import { errorHandler } from "./middleware/error";
import { requestContext } from "./middleware/request";
import { requireTrustedOrigin } from "./middleware/origin";
import { checkStorageReady } from "./services/storage";

const APP_VERSION = "2.0.3-v7";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-CBAI-Version", APP_VERSION);
    next();
  });
  if (config.TRUST_PROXY) app.set("trust proxy", 1);
  app.use(requestContext);
  app.use(
    pinoHttp({
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "req.body.apiKey",
          "*.apiKey",
        ],
        censor: "[REDACTED]",
      },
      genReqId: (request) => request.requestId,
    }),
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", "data:", "blob:", new URL(config.S3_ENDPOINT).origin],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-Id"],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(requireTrustedOrigin);

  app.get("/api/health/live", (_request, response) => {
    response.json({ status: "live", version: APP_VERSION });
  });

  app.get("/api/version", (_request, response) => {
    response.json({ version: APP_VERSION });
  });

  app.get("/api/health/ready", async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    await checkStorageReady();
    response.json({ status: "ready" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/cases", caseRoutes);
  app.use("/api", imageRoutes);
  app.use("/api", analysisRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/settings/users", userRoutes);
  app.use("/api/audit", auditRoutes);

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "API route not found",
      },
    });
  });

  if (config.NODE_ENV === "production") {
    const webDist = path.resolve(process.cwd(), "apps/web/dist");
    app.use(
      express.static(webDist, {
        index: false,
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use((request, response, next) => {
      if (request.method !== "GET") return next();
      response.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
      response.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
